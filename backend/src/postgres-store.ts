import { Prisma, PrismaClient } from "@prisma/client";
import type { ScenarioId } from "@rational/shared";
import type { Database } from "./types";
import {
  createSeedBundle,
  ensureStoreDirectories,
  JsonStore,
  readSigningSecrets,
  type ProofrailStore,
  writeSigningSecrets,
} from "./store";
import { isLimitedPublicApiMode } from "./runtime-config";

const STATE_ID = "default";
const MAX_UPDATE_ATTEMPTS = 5;

function toJson(database: Database): Prisma.InputJsonValue {
  return database as unknown as Prisma.InputJsonValue;
}

function fromJson(payload: Prisma.JsonValue): Database {
  return payload as unknown as Database;
}

async function loadLocalSeed(scenarioId?: ScenarioId): Promise<Database> {
  const jsonStore = new JsonStore();
  try {
    await jsonStore.init();
    return await jsonStore.read();
  } catch {
    const seeded = createSeedBundle(scenarioId);
    await writeSigningSecrets(seeded.secrets);
    return seeded.database;
  }
}

export class PostgresStateStore implements ProofrailStore {
  private readonly prisma: PrismaClient;
  private readonly stateId: string;

  constructor(prisma = new PrismaClient(), stateId = STATE_ID) {
    this.prisma = prisma;
    this.stateId = stateId;
  }

  async init(): Promise<void> {
    await ensureStoreDirectories();
    const current = await this.prisma.proofrailState.findUnique({
      where: { id: this.stateId },
    });
    if (current) {
      if (!isLimitedPublicApiMode()) {
        await readSigningSecrets();
      }
      return;
    }

    const database = await loadLocalSeed();
    await this.prisma.proofrailState.create({
      data: {
        id: this.stateId,
        schemaVersion: database.schemaVersion,
        revision: 0,
        payload: toJson(database),
      },
    });
  }

  async read(): Promise<Database> {
    const current = await this.prisma.proofrailState.findUnique({
      where: { id: this.stateId },
    });
    if (!current) {
      throw new Error("PostgreSQL store is not initialized");
    }
    return fromJson(current.payload);
  }

  async write(database: Database): Promise<void> {
    await this.prisma.proofrailState.upsert({
      where: { id: this.stateId },
      create: {
        id: this.stateId,
        schemaVersion: database.schemaVersion,
        revision: 0,
        payload: toJson(database),
      },
      update: {
        schemaVersion: database.schemaVersion,
        revision: { increment: 1 },
        payload: toJson(database),
      },
    });
  }

  async originPrivateKey(sourceId: string): Promise<string> {
    const secrets = await readSigningSecrets();
    const privateKeyPem = secrets.originPrivateKeys[sourceId];
    if (!privateKeyPem) throw new Error(`Signing key is unavailable for origin ${sourceId}`);
    return privateKeyPem;
  }

  async fabricPrivateKey(): Promise<string> {
    return (await readSigningSecrets()).fabricPrivateKeyPem;
  }

  async update<T>(mutator: (database: Database) => Promise<T> | T): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_UPDATE_ATTEMPTS; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const current = await tx.proofrailState.findUnique({
            where: { id: this.stateId },
          });
          if (!current) {
            throw new Error("PostgreSQL store is not initialized");
          }
          const database = fromJson(current.payload);
          const result = await mutator(database);
          const updated = await tx.proofrailState.updateMany({
            where: {
              id: this.stateId,
              revision: current.revision,
            },
            data: {
              schemaVersion: database.schemaVersion,
              revision: { increment: 1 },
              payload: toJson(database),
            },
          });
          if (updated.count !== 1) {
            throw new Error("PostgreSQL store update conflict");
          }
          return result;
        });
      } catch (error) {
        lastError = error;
        if (
          !(error instanceof Error) ||
          !error.message.includes("update conflict")
        ) {
          throw error;
        }
      }
    }
    throw lastError;
  }

  async reset(scenarioId?: ScenarioId): Promise<Database> {
    const current = await this.read().catch(() => null);
    const seeded = createSeedBundle(
      scenarioId ?? current?.selectedScenarioId ?? "agent_deploy",
    );
    await writeSigningSecrets(seeded.secrets);
    await this.write(seeded.database);
    return seeded.database;
  }
}
