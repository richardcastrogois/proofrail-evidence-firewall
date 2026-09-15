import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { generateSigningIdentity } from "@rational/core";
import type { PublicState, ServiceScope } from "@rational/shared";
import {
  ServiceAuthenticator,
  hashServiceToken,
} from "./service-auth";

const previousDataDir = process.env.DATA_DIR;
const previousPublicApiMode = process.env.PROOFRAIL_PUBLIC_API_MODE;
const dataDir = await mkdtemp(
  path.join(tmpdir(), "proofrail-limited-public-api-"),
);
process.env.DATA_DIR = dataDir;
process.env.PROOFRAIL_PUBLIC_API_MODE = "limited";

const orchestratorToken = randomBytes(32).toString("base64url");
const operatorToken = randomBytes(32).toString("base64url");
const approverToken = randomBytes(32).toString("base64url");
const executorToken = randomBytes(32).toString("base64url");
const approverIdentity = generateSigningIdentity();
const orchestratorScopes: ServiceScope[] = [
  "state:read",
  "evidence:collect",
  "decision:evaluate",
];
const operatorScopes: ServiceScope[] = [
  "state:read",
  "network:select",
  "simulation:run",
];
const authenticator = new ServiceAuthenticator({
  schemaVersion: 1,
  principals: [
    {
      id: "limited-api-orchestrator",
      kind: "orchestrator",
      scopes: orchestratorScopes,
      tokenSha256: hashServiceToken(orchestratorToken),
    },
    {
      id: "limited-api-operator",
      kind: "operator",
      scopes: operatorScopes,
      tokenSha256: hashServiceToken(operatorToken),
    },
    {
      id: "limited-api-approver",
      kind: "approver",
      scopes: ["state:read", "approval:create"],
      tokenSha256: hashServiceToken(approverToken),
    },
    {
      id: "limited-api-executor",
      kind: "executor",
      scopes: ["state:read", "permit:execute"],
      tokenSha256: hashServiceToken(executorToken),
    },
  ],
  approverKeys: [
    {
      id: "limited-api-approver-key",
      approverId: "limited-api-approver",
      publicKeyPem: approverIdentity.publicKeyPem,
    },
  ],
});

function bearer(token = orchestratorToken) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

async function assertLimited(
  app: ReturnType<typeof Fastify>,
  method: "POST",
  url: string,
  payload: unknown,
  token = orchestratorToken,
) {
  const response = await app.inject({
    method,
    url,
    headers: bearer(token),
    payload,
  });
  assert.equal(response.statusCode, 503, `${url} should be unavailable`);
  assert.equal(response.json().error.code, "ANCHOR_UNAVAILABLE");
}

const app = Fastify({ bodyLimit: 256 * 1024 });

try {
  const { JsonStore } = await import("./store");
  const { registerRoutes } = await import("./routes");
  const store = new JsonStore();
  await store.init();
  await registerRoutes(app, store, authenticator);

  const stateResponse = await app.inject({
    method: "GET",
    url: "/api/state",
    headers: bearer(orchestratorToken),
  });
  assert.equal(stateResponse.statusCode, 200);
  const state = stateResponse.json() as PublicState;
  const action = state.defaultAction;
  const source = state.origins.find(
    (origin) => origin.sourceClass !== "signed_approval",
  );
  assert.ok(source);

  const selfDeclaredResponse = await app.inject({
    method: "POST",
    url: "/api/evidence/self-declared",
    headers: {
      "content-type": "application/json",
    },
    payload: action,
  });
  assert.equal(selfDeclaredResponse.statusCode, 200);
  assert.equal(selfDeclaredResponse.json().sourceClass, "self_declared");

  const anonymousReset = await app.inject({
    method: "POST",
    url: "/api/reset",
    headers: {
      "content-type": "application/json",
    },
    payload: {},
  });
  assert.equal(anonymousReset.statusCode, 401);

  const anonymousExpire = await app.inject({
    method: "POST",
    url: "/api/lifecycle/expire",
  });
  assert.equal(anonymousExpire.statusCode, 401);

  const signedEvidenceResponse = await app.inject({
    method: "POST",
    url: "/api/evidence/collect",
    headers: bearer(orchestratorToken),
    payload: {
      action,
      sourceId: source.id,
      variant: "valid",
    },
  });
  assert.equal(signedEvidenceResponse.statusCode, 503);
  assert.equal(signedEvidenceResponse.json().error.code, "ANCHOR_UNAVAILABLE");

  await assertLimited(app, "POST", "/api/network/select", {
    network: "preprod",
  }, operatorToken);
  await assertLimited(app, "POST", "/api/evaluate", action);
  await assertLimited(app, "POST", "/api/simulation/run", action, operatorToken);
  await assertLimited(app, "POST", "/api/approvals", {}, approverToken);
  await assertLimited(app, "POST", "/api/execute", {
    permitId: "00000000-0000-4000-8000-000000000001",
  }, executorToken);
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
  if (previousDataDir === undefined) {
    delete process.env.DATA_DIR;
  } else {
    process.env.DATA_DIR = previousDataDir;
  }
  if (previousPublicApiMode === undefined) {
    delete process.env.PROOFRAIL_PUBLIC_API_MODE;
  } else {
    process.env.PROOFRAIL_PUBLIC_API_MODE = previousPublicApiMode;
  }
}
