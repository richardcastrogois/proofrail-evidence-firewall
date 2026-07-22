import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  AnchorRecord,
  DecisionResult,
  NetworkId,
  NetworkStatus,
} from "@rational/shared";

const execFileAsync = promisify(execFile);

export interface AnchorAdapter {
  anchor(decision: DecisionResult): Promise<AnchorRecord>;
}

class LocalAnchorAdapter implements AnchorAdapter {
  async anchor(decision: DecisionResult): Promise<AnchorRecord> {
    return {
      id: randomUUID(),
      network: "local-simulator",
      txId: null,
      contractAddress: null,
      evidenceRoot: decision.evidenceRoot,
      policyCommitment: decision.policyCommitment,
      actionCommitment: decision.actionCommitment,
      decision: decision.status,
      validUntil:
        decision.permit?.expiresAt ??
        new Date(Date.now() + 15 * 60_000).toISOString(),
      createdAt: new Date().toISOString(),
    };
  }
}

class MidnightCliAnchorAdapter implements AnchorAdapter {
  constructor(private readonly chainDirectory: string) {}

  async anchor(decision: DecisionResult): Promise<AnchorRecord> {
    const configuredTimeout = Number(
      process.env.MIDNIGHT_CLI_TIMEOUT_MS ?? 360_000,
    );
    const timeout =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 360_000;
    const validUntil =
      decision.permit?.expiresAt ??
      new Date(Date.now() + 15 * 60_000).toISOString();

    const args = [
      "run",
      "cli",
      "--",
      "anchor",
      decision.evidenceRoot,
      decision.policyCommitment,
      decision.actionCommitment,
      decision.status,
      String(new Date(validUntil).getTime()),
      String(decision.independentSources),
      String(decision.requiredSources),
      String(decision.contradictions.length),
    ];

    const { stdout, stderr } = await execFileAsync("npm", args, {
      cwd: path.resolve(this.chainDirectory),
      env: process.env,
      timeout,
      maxBuffer: 10 * 1024 * 1024,
    });

    const marker = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("ANCHOR_RESULT:"));

    if (!marker) {
      throw new Error(
        `Midnight CLI did not return an anchor result.\nstdout:\n${stdout}\nstderr:\n${stderr}`,
      );
    }

    const parsed = JSON.parse(
      marker.slice("ANCHOR_RESULT:".length),
    ) as {
      txId?: string;
      contractAddress?: string;
      network?: string;
    };

    return {
      id: randomUUID(),
      network: parsed.network ?? "midnight-local",
      txId: parsed.txId ?? null,
      contractAddress: parsed.contractAddress ?? null,
      evidenceRoot: decision.evidenceRoot,
      policyCommitment: decision.policyCommitment,
      actionCommitment: decision.actionCommitment,
      decision: decision.status,
      validUntil,
      createdAt: new Date().toISOString(),
    };
  }
}

export function createAnchorAdapter(): AnchorAdapter {
  const mode = process.env.MIDNIGHT_MODE ?? "local";

  if (mode === "cli") {
    const chainDirectory = process.env.MIDNIGHT_CHAIN_DIR;

    if (!chainDirectory) {
      throw new Error(
        "MIDNIGHT_CHAIN_DIR is required when MIDNIGHT_MODE=cli",
      );
    }

    return new MidnightCliAnchorAdapter(chainDirectory);
  }

  return new LocalAnchorAdapter();
}

function chainDirectory(): string | null {
  return process.env.MIDNIGHT_CHAIN_DIR
    ? path.resolve(process.env.MIDNIGHT_CHAIN_DIR)
    : null;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const directory = chainDirectory();
  const fallback: NetworkStatus = {
    active: "undeployed",
    deployments: { undeployed: null, preview: null, preprod: null },
    faucets: {
      undeployed: null,
      preview: "https://midnight-tmnight-preview.nethermind.dev",
      preprod: "https://midnight-tmnight-preprod.nethermind.dev",
    },
  };
  if (!directory) return fallback;

  try {
    const state = JSON.parse(
      await readFile(path.join(directory, ".midnight-state.json"), "utf8"),
    ) as {
      activeNetwork?: NetworkId;
      deployments?: Partial<Record<NetworkId, { address?: string }>>;
    };
    return {
      ...fallback,
      active: state.activeNetwork ?? "undeployed",
      deployments: {
        undeployed: state.deployments?.undeployed?.address ?? null,
        preview: state.deployments?.preview?.address ?? null,
        preprod: state.deployments?.preprod?.address ?? null,
      },
    };
  } catch {
    return fallback;
  }
}

export async function switchMidnightNetwork(
  network: NetworkId,
): Promise<NetworkStatus> {
  const directory = chainDirectory();
  if (!directory || (process.env.MIDNIGHT_MODE ?? "local") !== "cli") {
    throw new Error("Network switching requires MIDNIGHT_MODE=cli");
  }
  await execFileAsync("npm", ["run", "network", "--", network], {
    cwd: directory,
    env: process.env,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  return getNetworkStatus();
}
