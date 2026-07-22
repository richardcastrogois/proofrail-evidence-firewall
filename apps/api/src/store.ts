import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { generateSigningIdentity } from "@rational/core";
import {
  SCENARIOS,
  scenarioById,
  type AuditEvent,
  type ProposedAction,
  type ScenarioId,
} from "@rational/shared";
import type { Database, OriginRecord, SigningSecrets } from "./types";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? path.resolve(moduleDir, "../../../data");
const storePath = path.join(dataDir, "store.json");
const privateDir = path.join(dataDir, "private");
const signingSecretsPath = path.join(privateDir, "signing-secrets.json");
export const rawDir = path.join(dataDir, "raw");

interface SeedBundle {
  database: Database;
  secrets: SigningSecrets;
}

export function actionForScenario(scenarioId: ScenarioId): ProposedAction {
  const scenario = scenarioById(scenarioId);
  return { ...structuredClone(scenario.defaultAction), requestId: randomUUID() };
}

function createOrigin(
  source: (typeof SCENARIOS)[number]["sources"][number],
  scenarioId: ScenarioId,
): { origin: OriginRecord; privateKeyPem: string } {
  const identity = generateSigningIdentity();
  return {
    origin: {
      ...source,
      scenarioId,
      publicKeyPem: identity.publicKeyPem,
    },
    privateKeyPem: identity.privateKeyPem,
  };
}

export function auditEvent(
  type: string,
  message: string,
  metadata: Record<string, unknown> = {},
): AuditEvent {
  return {
    id: randomUUID(),
    type,
    message,
    createdAt: new Date().toISOString(),
    metadata,
  };
}

function seedBundle(scenarioId: ScenarioId = "agent_deploy"): SeedBundle {
  const scenario = scenarioById(scenarioId);
  const createdOrigins = SCENARIOS.flatMap((entry) =>
    entry.sources.map((source) => createOrigin(source, entry.id)),
  );
  const fabricIdentity = generateSigningIdentity();
  return {
    database: {
      schemaVersion: 4,
      selectedScenarioId: scenarioId,
      defaultAction: actionForScenario(scenarioId),
      policy: structuredClone(scenario.policy),
      origins: createdOrigins.map((entry) => entry.origin),
      fabricIdentity: { publicKeyPem: fabricIdentity.publicKeyPem },
      githubDeliveries: [],
      evidence: [],
      evidenceSecrets: {},
      decisions: [],
      anchors: [],
      executions: [],
      audit: [
        auditEvent(
          "SYSTEM_INITIALIZED",
          "Ambiente Proofrail inicializado com politicas de evidencia v4.",
        ),
      ],
    },
    secrets: {
      schemaVersion: 1,
      originPrivateKeys: Object.fromEntries(
        createdOrigins.map((entry) => [entry.origin.id, entry.privateKeyPem]),
      ),
      fabricPrivateKeyPem: fabricIdentity.privateKeyPem,
    },
  };
}

function isSigningSecrets(value: unknown): value is SigningSecrets {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SigningSecrets>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.fabricPrivateKeyPem === "string" &&
    candidate.fabricPrivateKeyPem.includes("PRIVATE KEY") &&
    candidate.originPrivateKeys !== null &&
    typeof candidate.originPrivateKeys === "object"
  );
}

function migrateV3(current: Record<string, unknown>): SeedBundle {
  const rawOrigins = Array.isArray(current.origins) ? current.origins : [];
  const rawFabric = current.fabricIdentity as Record<string, unknown> | undefined;
  if (
    rawOrigins.length === 0 ||
    !rawFabric ||
    typeof rawFabric.privateKeyPem !== "string" ||
    typeof rawFabric.publicKeyPem !== "string"
  ) {
    throw new Error("Store v3 cannot be migrated because signing identities are incomplete");
  }

  const originPrivateKeys: Record<string, string> = {};
  const origins = rawOrigins.map((raw) => {
    const origin = raw as Record<string, unknown>;
    if (
      typeof origin.id !== "string" ||
      typeof origin.privateKeyPem !== "string" ||
      typeof origin.publicKeyPem !== "string"
    ) {
      throw new Error("Store v3 contains an incomplete origin identity");
    }
    originPrivateKeys[origin.id] = origin.privateKeyPem;
    const { privateKeyPem: _privateKey, ...publicOrigin } = origin;
    return publicOrigin as unknown as OriginRecord;
  });

  const database = {
    ...current,
    schemaVersion: 4,
    origins,
    fabricIdentity: { publicKeyPem: rawFabric.publicKeyPem },
    githubDeliveries: [],
  } as unknown as Database;
  database.audit.push(
    auditEvent(
      "SIGNING_SECRETS_MIGRATED",
      "Chaves privadas foram removidas do store principal e isoladas no cofre local.",
    ),
  );
  return {
    database,
    secrets: {
      schemaVersion: 1,
      originPrivateKeys,
      fabricPrivateKeyPem: rawFabric.privateKeyPem,
    },
  };
}

export class JsonStore {
  private queue: Promise<unknown> = Promise.resolve();

  private async writeSecrets(secrets: SigningSecrets): Promise<void> {
    await mkdir(privateDir, { recursive: true });
    const temporaryPath = `${signingSecretsPath}.tmp-${process.pid}`;
    await writeFile(temporaryPath, JSON.stringify(secrets, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, signingSecretsPath);
  }

  private async readSecrets(): Promise<SigningSecrets> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(signingSecretsPath, "utf8"));
    } catch (error) {
      throw new Error(
        `Signing secrets are unavailable at ${signingSecretsPath}. Restore the secret file instead of rotating identities silently.`,
        { cause: error },
      );
    }
    if (!isSigningSecrets(parsed)) {
      throw new Error("Signing secrets have an invalid schema");
    }
    return parsed;
  }

  async init(): Promise<void> {
    await mkdir(rawDir, { recursive: true });
    await mkdir(privateDir, { recursive: true });

    let current: Record<string, unknown>;
    try {
      current = JSON.parse(await readFile(storePath, "utf8")) as Record<string, unknown>;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error("The Proofrail store is unreadable or invalid JSON", { cause: error });
      }
      const seeded = seedBundle();
      await this.writeSecrets(seeded.secrets);
      await this.write(seeded.database);
      return;
    }

    if (current.schemaVersion === 4) {
      await this.readSecrets();
      return;
    }
    if (current.schemaVersion !== 3) {
      throw new Error(
        `Unsupported store schema ${String(current.schemaVersion)}. Preserve the file and migrate explicitly.`,
      );
    }

    const backup = path.join(
      privateDir,
      `store.v3.backup-${Date.now()}.json`,
    );
    await copyFile(storePath, backup);
    const migrated = migrateV3(current);
    await this.writeSecrets(migrated.secrets);
    await this.write(migrated.database);
  }

  async read(): Promise<Database> {
    return JSON.parse(await readFile(storePath, "utf8")) as Database;
  }

  async write(database: Database): Promise<void> {
    await mkdir(dataDir, { recursive: true });
    const temporaryPath = `${storePath}.tmp-${process.pid}`;
    await writeFile(temporaryPath, JSON.stringify(database, null, 2), "utf8");
    await rename(temporaryPath, storePath);
  }

  async originPrivateKey(sourceId: string): Promise<string> {
    const secrets = await this.readSecrets();
    const privateKeyPem = secrets.originPrivateKeys[sourceId];
    if (!privateKeyPem) throw new Error(`Signing key is unavailable for origin ${sourceId}`);
    return privateKeyPem;
  }

  async fabricPrivateKey(): Promise<string> {
    return (await this.readSecrets()).fabricPrivateKeyPem;
  }

  async update<T>(mutator: (database: Database) => Promise<T> | T): Promise<T> {
    const operation = this.queue.then(async () => {
      const database = await this.read();
      const result = await mutator(database);
      await this.write(database);
      return result;
    });
    this.queue = operation.then(() => undefined, () => undefined);
    return operation as Promise<T>;
  }

  async reset(scenarioId?: ScenarioId): Promise<Database> {
    const current = await this.read().catch(() => null);
    const seeded = seedBundle(
      scenarioId ?? current?.selectedScenarioId ?? "agent_deploy",
    );
    await this.writeSecrets(seeded.secrets);
    await this.write(seeded.database);
    return seeded.database;
  }
}
