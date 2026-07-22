/**
 * Proofrail CLI override for the create-mn-app hello-world scaffold.
 *
 * Commands:
 *   npm run cli -- anchor <evidenceRoot> <policyCommitment> <actionCommitment> <decision> <validUntilMs> <evidenceCount> <requiredEvidenceCount> <contradictionCount>
 *   npm run cli -- read
 */
import * as fs from "node:fs";
import * as path from "node:path";
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
  getDeployment,
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

const compiledContract = CompiledContract.make(
  "hello-world",
  Proofrail.Contract,
).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(zkConfigPath),
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
  const [command, ...args] = process.argv.slice(2);
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

    const deployed: any = await findDeployedContract(
      providers,
      {
        compiledContract: compiledContract as any,
        contractAddress: deployment.address,
        privateStateId: PRIVATE_STATE_ID,
        initialPrivateState: {},
      },
    );

    if (command === "anchor") {
      if (args.length !== 8) {
        throw new Error(
          "anchor requires evidenceRoot policyCommitment actionCommitment decision validUntilMs evidenceCount requiredEvidenceCount contradictionCount",
        );
      }

      const [
        evidenceRoot,
        policyCommitment,
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
          },
          null,
          2,
        ),
      );
      return;
    }

    throw new Error(
      "Use: npm run cli -- anchor ... or npm run cli -- read",
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
