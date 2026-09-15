import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { generateSigningIdentity } from "@rational/core";
import { scenarioById } from "@rational/shared";

const testDir = await mkdtemp(path.join(os.tmpdir(), "proofrail-store-test-"));
process.env.DATA_DIR = testDir;

try {
  const scenario = scenarioById("agent_deploy");
  const originIdentity = generateSigningIdentity();
  const fabricIdentity = generateSigningIdentity();
  const source = scenario.sources[0]!;
  await writeFile(
    path.join(testDir, "store.json"),
    JSON.stringify({
      schemaVersion: 3,
      selectedScenarioId: scenario.id,
      defaultAction: scenario.defaultAction,
      policy: scenario.policy,
      origins: [
        {
          ...source,
          scenarioId: scenario.id,
          ...originIdentity,
        },
      ],
      fabricIdentity,
      evidence: [],
      evidenceSecrets: {},
      decisions: [],
      anchors: [],
      executions: [],
      audit: [],
    }),
    "utf8",
  );

  const { JsonStore } = await import("./store");
  const store = new JsonStore();
  await store.init();
  const database = await store.read();
  assert.equal(database.schemaVersion, 6);
  assert.deepEqual(database.approvals, []);
  assert.equal("privateKeyPem" in database.origins[0]!, false);
  assert.equal("privateKeyPem" in database.fabricIdentity, false);
  assert.equal(await store.originPrivateKey(source.id), originIdentity.privateKeyPem);
  assert.equal(await store.fabricPrivateKey(), fabricIdentity.privateKeyPem);

  const privateFiles = await readdir(path.join(testDir, "private"));
  assert.ok(privateFiles.includes("signing-secrets.json"));
  assert.ok(privateFiles.some((name) => name.startsWith("store.v3.backup-")));
  const publicStore = await readFile(path.join(testDir, "store.json"), "utf8");
  assert.doesNotMatch(publicStore, /BEGIN PRIVATE KEY/);

  const { approvals: _approvals, ...databaseV4 } = database;
  await writeFile(
    path.join(testDir, "store.json"),
    JSON.stringify({ ...databaseV4, schemaVersion: 4 }),
    "utf8",
  );
  await store.init();
  const migratedV4 = await store.read();
  assert.equal(migratedV4.schemaVersion, 6);
  assert.deepEqual(migratedV4.approvals, []);
  const filesAfterV4 = await readdir(path.join(testDir, "private"));
  assert.ok(
    filesAfterV4.some((name) => name.startsWith("store.v4.backup-")),
  );

  const legacyExecutionId = randomUUID();
  await writeFile(
    path.join(testDir, "store.json"),
    JSON.stringify({
      ...migratedV4,
      schemaVersion: 5,
      executions: [
        {
          id: legacyExecutionId,
          permitId: randomUUID(),
          action: scenario.defaultAction,
          executedAt: "2026-07-23T12:00:00.000Z",
        },
      ],
    }),
    "utf8",
  );
  await store.init();
  const migratedV5 = await store.read();
  assert.equal(migratedV5.schemaVersion, 6);
  assert.deepEqual(migratedV5.executions[0], {
    id: legacyExecutionId,
    permitId: migratedV5.executions[0]!.permitId,
    requestId: scenario.defaultAction.requestId,
    actionCommitment: migratedV5.executions[0]!.actionCommitment,
    idempotencyKey: legacyExecutionId,
    status: "succeeded",
    createdAt: "2026-07-23T12:00:00.000Z",
    updatedAt: "2026-07-23T12:00:00.000Z",
    startedAt: "2026-07-23T12:00:00.000Z",
    finishedAt: "2026-07-23T12:00:00.000Z",
    externalReference: `legacy-simulation:${legacyExecutionId}`,
    failureCode: null,
  });
  const filesAfterV5 = await readdir(path.join(testDir, "private"));
  assert.ok(
    filesAfterV5.some((name) => name.startsWith("store.v5.backup-")),
  );
  console.log("Proofrail store migration self-test passed");
} finally {
  await rm(testDir, { recursive: true, force: true });
}
