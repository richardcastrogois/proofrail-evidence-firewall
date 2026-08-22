/**
 * Proofrail CLI override for the create-mn-app hello-world scaffold.
 *
 * Commands:
 *   npm run cli -- anchor <evidenceRoot> <policyCommitment> <policyVersion> <actionCommitment> <decision> <validUntilSeconds> <evidenceCount> <requiredEvidenceCount> <contradictionCount>
 *   npm run cli -- read --network preview
 *   npm run cli -- security-check --network preprod
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WebSocket } from "ws";
import { findDeployedContract } from "@midnight-ntwrk/midnight-js-contracts";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { levelPrivateStateProvider } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import { NodeZkConfigProvider } from "@midnight-ntwrk/midnight-js-node-zk-config-provider";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import {
  resolveNetwork,
  getOrCreateSeed,
  getOrCreateRegistrarSecret,
  getDeployment,
  recordRegistrarRotation,
} from "./network";
import {
  createWallet,
  persistWalletState,
  type WalletContext,
} from "./wallet";

// @ts-expect-error Midnight wallet sync requires a global WebSocket.
globalThis.WebSocket = WebSocket;

const PRIVATE_STATE_ID = "helloWorldPrivateState";
const { network, config: networkConfig } = resolveNetwork();
const seed = getOrCreateSeed(network);
const registrarSecretHex = getOrCreateRegistrarSecret(network);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const zkConfigPath = path.resolve(
  __dirname,
  "..",
  "contracts",
  "managed",
  "hello-world",
);
const contractPath = path.join(
  zkConfigPath,
  "contract",
  "index.js",
);

if (!fs.existsSync(contractPath)) {
  throw new Error("Contract not compiled. Run npm run compile.");
}

const Proofrail = await import(
  pathToFileURL(contractPath).href
);

function bytes32FromHex(value: string): Uint8Array {
  const normalized = value.startsWith("0x")
    ? value.slice(2)
    : value;

  if (!/^[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(
      `Expected a 32-byte hexadecimal value, received: ${value}`,
    );
  }

  return Uint8Array.from(
    normalized.match(/.{2}/g)!.map((byte) =>
      Number.parseInt(byte, 16),
    ),
  );
}

function hexFromBytes(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

function compiledContractFor(secret: Uint8Array) {
  return CompiledContract.make(
    "hello-world",
    Proofrail.Contract,
  ).pipe(
    (CompiledContract.withWitnesses as any)({
      registrarSecret(context: { privateState: unknown }) {
        return [context.privateState, secret] as [unknown, Uint8Array];
      },
    }),
    (CompiledContract.withCompiledFileAssets as any)(zkConfigPath),
  );
}

async function createProviders(walletCtx: WalletContext) {
  const privateStatePassword =
    process.env.PRIVATE_STATE_PASSWORD?.trim() ||
    "Local-Devnet-Development-Placeholder-1";

  const walletProvider = {
    getCoinPublicKey: () =>
      walletCtx.shieldedSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () =>
      walletCtx.shieldedSecretKeys.encryptionPublicKey,
    async balanceTx(tx: unknown, ttl?: Date) {
      const recipe =
        await walletCtx.wallet.balanceUnboundTransaction(
          tx as never,
          {
            shieldedSecretKeys:
              walletCtx.shieldedSecretKeys,
            dustSecretKey: walletCtx.dustSecretKey,
          },
          {
            ttl:
              ttl ??
              new Date(Date.now() + 30 * 60 * 1000),
          },
        );

      return walletCtx.wallet.finalizeRecipe(recipe);
    },
    submitTx: (tx: unknown) =>
      walletCtx.wallet.submitTransaction(tx as never) as never,
  };

  const zkConfigProvider = new NodeZkConfigProvider(
    zkConfigPath,
  );
  const accountId =
    walletCtx.unshieldedKeystore
      .getBech32Address()
      .toString();

  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: "rational-gate-state",
      accountId,
      privateStoragePasswordProvider: () =>
        privateStatePassword,
    }),
    publicDataProvider: indexerPublicDataProvider(
      networkConfig.indexer,
      networkConfig.indexerWS,
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(
      networkConfig.proofServer,
      zkConfigProvider,
    ),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

function decisionValue(value: string) {
  switch (value) {
    case "ALLOW":
      return Proofrail.Decision.ALLOW;
    case "REVIEW_REQUIRED":
      return Proofrail.Decision.REVIEW_REQUIRED;
    case "DENY":
      return Proofrail.Decision.DENY;
    default:
      throw new Error(`Unknown decision: ${value}`);
  }
}

async function main() {
  const commandArgs = process.argv.slice(2).filter((value, index, values) => {
    if (value.startsWith("--network=")) return false;
    if (value === "--network") return false;
    if (index > 0 && values[index - 1] === "--network") return false;
    return true;
  });
  const [command, ...args] = commandArgs;
  const deployment = getDeployment(network);

  if (!deployment) {
    throw new Error(
      `No deployment for ${network}. Run npm run setup first.`,
    );
  }

  const walletCtx = await createWallet({
    network,
    networkConfig,
    seed,
  });

  try {
    await walletCtx.wallet.waitForSyncedState();
    await persistWalletState(network, walletCtx);
    const providers = await createProviders(walletCtx);

    const bindContract = async (secret: Uint8Array) =>
      findDeployedContract(providers, {
        compiledContract: compiledContractFor(secret) as any,
        contractAddress: deployment.address,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      }) as Promise<any>;
    const registrarSecret = bytes32FromHex(registrarSecretHex);
    let deployed = await bindContract(registrarSecret);

    if (command === "anchor") {
      if (args.length !== 9) {
        throw new Error(
          "anchor requires evidenceRoot policyCommitment policyVersion actionCommitment decision validUntilUnixSeconds evidenceCount requiredEvidenceCount contradictionCount",
        );
      }

      const [
        evidenceRoot,
        policyCommitment,
        policyVersion,
        actionCommitment,
        decision,
        validUntil,
        evidenceCount,
        requiredEvidenceCount,
        contradictionCount,
      ] = args;

      const tx = await deployed.callTx.registerDecision(
        bytes32FromHex(evidenceRoot!),
        bytes32FromHex(policyCommitment!),
        BigInt(policyVersion!),
        bytes32FromHex(actionCommitment!),
        decisionValue(decision!),
        BigInt(validUntil!),
        BigInt(evidenceCount!),
        BigInt(requiredEvidenceCount!),
        BigInt(contradictionCount!),
      );

      console.log(
        `ANCHOR_RESULT:${JSON.stringify({
          network,
          contractAddress: deployment.address,
          txId: tx.public.txId ?? tx.public.txHash ?? null,
          blockHeight: String(tx.public.blockHeight ?? ""),
        })}`,
      );
      return;
    }

    if (command === "rotate-registrar") {
      if (args.length !== 0) throw new Error("rotate-registrar does not accept arguments");
      const nextSecret = randomBytes(32);
      const tx = await deployed.callTx.rotateRegistrar(nextSecret);
      recordRegistrarRotation(network, hexFromBytes(nextSecret));
      console.log(
        `REGISTRAR_RESULT:${JSON.stringify({
          operation: "rotated",
          network,
          contractAddress: deployment.address,
          txId: tx.public.txId ?? tx.public.txHash ?? null,
        })}`,
      );
      return;
    }

    if (command === "revoke-registrar") {
      if (args.length !== 0) throw new Error("revoke-registrar does not accept arguments");
      const tx = await deployed.callTx.revokeRegistrar();
      console.log(
        `REGISTRAR_RESULT:${JSON.stringify({
          operation: "revoked",
          network,
          contractAddress: deployment.address,
          txId: tx.public.txId ?? tx.public.txHash ?? null,
        })}`,
      );
      return;
    }

    if (command === "security-check") {
      if (args.length !== 0) throw new Error("security-check does not accept arguments");
      const future = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);
      const expired = BigInt(Math.floor(Date.now() / 1000) - 60);
      const evidenceRoot = randomBytes(32);
      const policyCommitment = randomBytes(32);
      const policyVersion = 1n;
      const actionCommitment = randomBytes(32);
      const checks: Array<{ name: string; passed: boolean }> = [];
      const expectRejected = async (name: string, operation: () => Promise<unknown>) => {
        try {
          await operation();
          checks.push({ name, passed: false });
        } catch {
          checks.push({ name, passed: true });
        }
      };

      const unauthorized = await bindContract(randomBytes(32));
      await expectRejected("unauthorized_registrar", () =>
        unauthorized.callTx.registerDecision(
          evidenceRoot,
          policyCommitment,
          policyVersion,
          actionCommitment,
          Proofrail.Decision.ALLOW,
          future,
          2n,
          2n,
          0n,
        ),
      );
      await expectRejected("insufficient_evidence", () =>
        deployed.callTx.registerDecision(
          evidenceRoot,
          policyCommitment,
          policyVersion,
          randomBytes(32),
          Proofrail.Decision.ALLOW,
          future,
          1n,
          2n,
          0n,
        ),
      );
      await expectRejected("contradiction_blocks_allow", () =>
        deployed.callTx.registerDecision(
          evidenceRoot,
          policyCommitment,
          policyVersion,
          randomBytes(32),
          Proofrail.Decision.ALLOW,
          future,
          2n,
          2n,
          1n,
        ),
      );
      await expectRejected("expired_decision", () =>
        deployed.callTx.registerDecision(
          evidenceRoot,
          policyCommitment,
          policyVersion,
          randomBytes(32),
          Proofrail.Decision.REVIEW_REQUIRED,
          expired,
          1n,
          2n,
          0n,
        ),
      );

      const accepted = await deployed.callTx.registerDecision(
        evidenceRoot,
        policyCommitment,
        policyVersion,
        actionCommitment,
        Proofrail.Decision.ALLOW,
        future,
        2n,
        2n,
        0n,
      );
      checks.push({ name: "authorized_allow", passed: true });
      await expectRejected("allow_replay", () =>
        deployed.callTx.registerDecision(
          evidenceRoot,
          policyCommitment,
          policyVersion,
          actionCommitment,
          Proofrail.Decision.ALLOW,
          future,
          2n,
          2n,
          0n,
        ),
      );

      const previousRegistrar = deployed;
      const rotatedSecret = randomBytes(32);
      await previousRegistrar.callTx.rotateRegistrar(rotatedSecret);
      recordRegistrarRotation(network, hexFromBytes(rotatedSecret));
      deployed = await bindContract(rotatedSecret);
      checks.push({ name: "registrar_rotation", passed: true });
      await expectRejected("previous_registrar_rejected", () =>
        previousRegistrar.callTx.registerDecision(
          randomBytes(32),
          policyCommitment,
          policyVersion,
          randomBytes(32),
          Proofrail.Decision.REVIEW_REQUIRED,
          future,
          1n,
          2n,
          0n,
        ),
      );

      await deployed.callTx.revokeRegistrar();
      await expectRejected("revoked_registrar_rejected", () =>
        deployed.callTx.registerDecision(
          randomBytes(32),
          policyCommitment,
          policyVersion,
          randomBytes(32),
          Proofrail.Decision.REVIEW_REQUIRED,
          future,
          1n,
          2n,
          0n,
        ),
      );

      const recoverySecret = randomBytes(32);
      await deployed.callTx.rotateRegistrar(recoverySecret);
      recordRegistrarRotation(network, hexFromBytes(recoverySecret));
      deployed = await bindContract(recoverySecret);
      const recoveredState = await providers.publicDataProvider.queryContractState(
        deployment.address,
      );
      if (!recoveredState) throw new Error("Recovered contract state not found");
      const recoveredLedger = Proofrail.ledger(recoveredState.data);
      checks.push({
        name: "registrar_recovery",
        passed: recoveredLedger.registrarRevoked === false,
      });

      const passed = checks.every((check) => check.passed);
      console.log(
        `SECURITY_RESULT:${JSON.stringify({
          passed,
          network,
          contractAddress: deployment.address,
          txId: accepted.public.txId ?? accepted.public.txHash ?? null,
          checks,
        })}`,
      );
      if (!passed) process.exitCode = 1;
      return;
    }

    if (command === "read") {
      const contractState =
        await providers.publicDataProvider.queryContractState(
          deployment.address,
        );

      if (!contractState) {
        throw new Error("Contract state not found");
      }

      const ledger = Proofrail.ledger(contractState.data);

      console.log(
        JSON.stringify(
          {
            network,
            contractAddress: deployment.address,
            nextId: String(ledger.nextId),
            registrarCommitment: hexFromBytes(ledger.registrarCommitment),
            registrarRevoked: ledger.registrarRevoked,
            registrarEpoch: String(ledger.registrarEpoch),
          },
          null,
          2,
        ),
      );
      return;
    }

    throw new Error(
      "Use: npm run cli -- anchor ... | read | security-check | rotate-registrar | revoke-registrar",
    );
  } finally {
    await persistWalletState(network, walletCtx);
    await walletCtx.wallet.stop();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
