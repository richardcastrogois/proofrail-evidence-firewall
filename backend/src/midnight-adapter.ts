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
  anchor(decision: DecisionResult, policyVersion: number): Promise<AnchorRecord>;
}

export class MidnightAnchorError extends Error {
  constructor(
    readonly code: "MIDNIGHT_ANCHOR_TIMEOUT" | "MIDNIGHT_ANCHOR_FAILED",
    message: string,
    readonly timeoutMs?: number,
  ) {
    super(message);
  }
}

function npmInvocation(args: string[]) {
  if (process.platform === "win32") {
    return { command: "npm.cmd", args };
  }
  const quotedArgs = args
    .map((arg) => `'${arg.replaceAll("'", "'\\''")}'`)
    .join(" ");
  return {
    command: "/bin/bash",
    args: [
      "-lc",
      `source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true; npm ${quotedArgs}`,
    ],
  };
}

class LocalAnchorAdapter implements AnchorAdapter {
  async anchor(decision: DecisionResult, policyVersion: number): Promise<AnchorRecord> {
    return {
      id: randomUUID(),
      network: "local-simulator",
      txId: null,
      contractAddress: null,
      evidenceRoot: decision.evidenceRoot,
      policyCommitment: decision.policyCommitment,
      policyVersion,
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

  async anchor(decision: DecisionResult, policyVersion: number): Promise<AnchorRecord> {
    const configuredTimeout = Number(
      process.env.MIDNIGHT_CLI_TIMEOUT_MS ?? 600_000,
    );
    const timeout =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? configuredTimeout
        : 600_000;
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
      String(policyVersion),
      decision.actionCommitment,
      decision.status,
      String(Math.floor(new Date(validUntil).getTime() / 1_000)),
      String(decision.independentSources),
      String(decision.requiredSources),
      String(decision.contradictions.length),
    ];
    const npm = npmInvocation(args);

    let stdout: string;
    let stderr: string;
    try {
      const result = await execFileAsync(npm.command, npm.args, {
        cwd: path.resolve(this.chainDirectory),
        env: process.env,
        timeout,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = result.stdout;
      stderr = result.stderr;
    } catch (error) {
      const details = error as NodeJS.ErrnoException & {
        killed?: boolean;
        signal?: NodeJS.Signals;
      };
      const timedOut =
        details.killed === true ||
        details.signal === "SIGTERM" ||
        details.code === "ETIMEDOUT";
      if (timedOut) {
        throw new MidnightAnchorError(
          "MIDNIGHT_ANCHOR_TIMEOUT",
          `Midnight CLI did not return an anchor result within ${Math.round(timeout / 1_000)} seconds.`,
          timeout,
        );
      }
      throw new MidnightAnchorError(
        "MIDNIGHT_ANCHOR_FAILED",
        "Midnight CLI failed before returning an anchor result.",
      );
    }

    const marker = stdout
      .split(/\r?\n/)
      .find((line) => line.startsWith("ANCHOR_RESULT:"));

    if (!marker) {
      throw new MidnightAnchorError(
        "MIDNIGHT_ANCHOR_FAILED",
        `Midnight CLI did not return an anchor result. stdout bytes=${Buffer.byteLength(stdout)} stderr bytes=${Buffer.byteLength(stderr)}`,
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
      policyVersion,
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
  const npm = npmInvocation(["run", "network", "--", network]);
  await execFileAsync(npm.command, npm.args, {
    cwd: directory,
    env: process.env,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
  });
  return getNetworkStatus();
}
