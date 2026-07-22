import assert from "node:assert/strict";
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
  assert.equal(database.schemaVersion, 4);
  assert.equal("privateKeyPem" in database.origins[0]!, false);
  assert.equal("privateKeyPem" in database.fabricIdentity, false);
  assert.equal(await store.originPrivateKey(source.id), originIdentity.privateKeyPem);
  assert.equal(await store.fabricPrivateKey(), fabricIdentity.privateKeyPem);

  const privateFiles = await readdir(path.join(testDir, "private"));
  assert.ok(privateFiles.includes("signing-secrets.json"));
  assert.ok(privateFiles.some((name) => name.startsWith("store.v3.backup-")));
  const publicStore = await readFile(path.join(testDir, "store.json"), "utf8");
  assert.doesNotMatch(publicStore, /BEGIN PRIVATE KEY/);
  console.log("Proofrail store migration self-test passed");
} finally {
  await rm(testDir, { recursive: true, force: true });
}
