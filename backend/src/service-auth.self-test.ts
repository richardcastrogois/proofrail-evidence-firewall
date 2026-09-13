import assert from "node:assert/strict";
import {
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import {
  ServiceAuthFileSchema,
  ServiceAuthenticator,
  hashServiceToken,
} from "./service-auth";

const dataDir = await mkdtemp(
  path.join(tmpdir(), "proofrail-service-auth-"),
);
process.env.DATA_DIR = dataDir;

const tokens = {
  orchestrator: randomBytes(32).toString("base64url"),
  approver: randomBytes(32).toString("base64url"),
  executor: randomBytes(32).toString("base64url"),
  operator: randomBytes(32).toString("base64url"),
};
const approverIdentity = generateKeyPairSync("ed25519");
const approverPublicKeyPem = approverIdentity.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const config = {
  schemaVersion: 1 as const,
  principals: [
    {
      id: "orchestrator-local",
      kind: "orchestrator" as const,
      scopes: [
        "state:read",
        "github:verify-ci",
        "evidence:collect",
        "decision:evaluate",
      ],
      tokenSha256: hashServiceToken(tokens.orchestrator),
    },
    {
      id: "human-reviewer-01",
      kind: "approver" as const,
      scopes: ["state:read", "approval:create"],
      tokenSha256: hashServiceToken(tokens.approver),
    },
    {
      id: "executor-local",
      kind: "executor" as const,
      scopes: ["state:read", "permit:execute"],
      tokenSha256: hashServiceToken(tokens.executor),
    },
    {
      id: "operator-local",
      kind: "operator" as const,
      scopes: [
        "state:read",
        "scenario:select",
        "network:select",
        "evidence:expire",
        "evidence:raw:read",
        "simulation:run",
        "system:reset",
      ],
      tokenSha256: hashServiceToken(tokens.operator),
    },
  ],
  approverKeys: [
    {
      id: "approver-key-local",
      approverId: "human-reviewer-01",
      publicKeyPem: approverPublicKeyPem,
    },
  ],
};

assert.equal(ServiceAuthFileSchema.safeParse(config).success, true);
assert.equal(
  ServiceAuthFileSchema.safeParse({
    ...config,
    principals: config.principals.map((principal) => ({
      ...principal,
      tokenSha256: hashServiceToken(tokens.orchestrator),
    })),
  }).success,
  false,
  "service tokens cannot be shared",
);
assert.equal(
  ServiceAuthFileSchema.safeParse({
    ...config,
    principals: config.principals.map((principal) =>
      principal.kind === "approver"
        ? { ...principal, scopes: ["permit:execute"] }
        : principal,
    ),
  }).success,
  false,
  "approver principals cannot receive executor scope",
);

const auth = new ServiceAuthenticator(config);
const app = Fastify({ bodyLimit: 256 * 1024 });

try {
  const { JsonStore } = await import("./store");
  const { registerRoutes } = await import("./routes");
  const store = new JsonStore();
  await store.init();
  await registerRoutes(app, store, auth);

  const health = await app.inject({
    method: "GET",
    url: "/api/health",
  });
  assert.equal(health.statusCode, 200);

  const missing = await app.inject({
    method: "GET",
    url: "/api/state",
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, "AUTHENTICATION_REQUIRED");
  assert.match(
    String(missing.headers["www-authenticate"] ?? ""),
    /Bearer/,
  );
  assert.match(
    String(missing.headers["x-request-id"] ?? ""),
    /^[0-9a-f-]{36}$/,
  );

  const invalid = await app.inject({
    method: "GET",
    url: "/api/state",
    headers: {
      authorization: `Bearer ${randomBytes(32).toString("base64url")}`,
    },
  });
  assert.equal(invalid.statusCode, 401);
  assert.equal(invalid.json().error.code, "INVALID_CREDENTIALS");

  const state = await app.inject({
    method: "GET",
    url: "/api/state",
    headers: {
      authorization: `Bearer ${tokens.orchestrator}`,
    },
  });
  assert.equal(state.statusCode, 200);

  const insufficient = await app.inject({
    method: "POST",
    url: "/api/reset",
    headers: {
      authorization: `Bearer ${tokens.orchestrator}`,
      "content-type": "application/json",
    },
    payload: {},
  });
  assert.equal(insufficient.statusCode, 403);
  assert.equal(insufficient.json().error.code, "INSUFFICIENT_SCOPE");

  const reset = await app.inject({
    method: "POST",
    url: "/api/reset",
    headers: {
      authorization: `Bearer ${tokens.operator}`,
      "content-type": "application/json",
    },
    payload: {},
  });
  assert.equal(reset.statusCode, 200);

  const webhook = await app.inject({
    method: "POST",
    url: "/api/integrations/github/webhook",
    headers: { "content-type": "application/json" },
    payload: "{}",
  });
  assert.notEqual(
    webhook.json().error?.code,
    "AUTHENTICATION_REQUIRED",
    "the webhook keeps its HMAC authentication boundary",
  );

  console.log("Proofrail service authentication self-test passed");
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
