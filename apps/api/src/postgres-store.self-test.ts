import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(moduleDir, "../../..");

for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(rootDir, envFile);
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for postgres-store.self-test");
}

const testDir = await mkdtemp(path.join(os.tmpdir(), "proofrail-postgres-store-test-"));
process.env.DATA_DIR = testDir;

const stateId = `self-test-${randomUUID()}`;
const prisma = new PrismaClient();

try {
  await prisma.proofrailState.deleteMany({ where: { id: stateId } });

  const { PostgresStateStore } = await import("./postgres-store");
  const { auditEvent } = await import("./store");

  const store = new PostgresStateStore(prisma, stateId);
  await store.init();

  const initialized = await store.read();
  assert.equal(initialized.schemaVersion, 6);
  assert.equal(initialized.selectedScenarioId, "agent_deploy");
  assert.equal(initialized.origins.length > 0, true);
  assert.equal(JSON.stringify(initialized).includes("BEGIN PRIVATE KEY"), false);

  const source = initialized.origins[0]!;
  assert.match(await store.originPrivateKey(source.id), /BEGIN PRIVATE KEY/);
  assert.match(await store.fabricPrivateKey(), /BEGIN PRIVATE KEY/);

  const restartedStore = new PostgresStateStore(prisma, stateId);
  await restartedStore.init();
  assert.equal((await restartedStore.read()).defaultAction.requestId, initialized.defaultAction.requestId);

  await restartedStore.update((database) => {
    database.audit.push(auditEvent("POSTGRES_SELF_TEST_SINGLE", "single update"));
  });

  let firstTwoMutatorsStarted = 0;
  let releaseFirstTwoMutators: (() => void) | undefined;
  const firstTwoMutatorsReady = new Promise<void>((resolve) => {
    releaseFirstTwoMutators = resolve;
  });

  async function concurrentUpdate(label: string): Promise<void> {
    await restartedStore.update(async (database) => {
      firstTwoMutatorsStarted += 1;
      if (firstTwoMutatorsStarted === 2) {
        releaseFirstTwoMutators?.();
      }
      if (firstTwoMutatorsStarted <= 2) {
        await firstTwoMutatorsReady;
      }
      database.audit.push(auditEvent("POSTGRES_SELF_TEST_CONCURRENT", label));
    });
  }

  await Promise.all([
    concurrentUpdate("concurrent-a"),
    concurrentUpdate("concurrent-b"),
  ]);

  const afterConcurrency = await restartedStore.read();
  assert.equal(
    afterConcurrency.audit.filter((entry) => entry.type === "POSTGRES_SELF_TEST_CONCURRENT").length,
    2,
  );

  const persisted = await prisma.proofrailState.findUniqueOrThrow({
    where: { id: stateId },
  });
  assert.equal(persisted.revision >= 3, true);
  assert.equal(JSON.stringify(persisted.payload).includes("BEGIN PRIVATE KEY"), false);

  const reset = await restartedStore.reset("supplier_payment");
  assert.equal(reset.selectedScenarioId, "supplier_payment");
  assert.equal((await restartedStore.read()).selectedScenarioId, "supplier_payment");

  const secretFile = await readFile(path.join(testDir, "private", "signing-secrets.json"), "utf8");
  assert.match(secretFile, /BEGIN PRIVATE KEY/);

  console.log("Proofrail PostgreSQL store self-test passed");
} finally {
  await prisma.proofrailState.deleteMany({ where: { id: stateId } }).catch(() => undefined);
  await prisma.$disconnect();
  await rm(testDir, { recursive: true, force: true });
}
