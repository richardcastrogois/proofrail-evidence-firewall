import assert from "node:assert/strict";
import {
  createHmac,
  generateKeyPairSync,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { generateSigningIdentity, signCanonical } from "@rational/core";

const dataDir = await mkdtemp(path.join(tmpdir(), "proofrail-github-routes-"));
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const appPrivateKeyPem = rsa.privateKey.export({
  type: "pkcs8",
  format: "pem",
}).toString();
const agentIdentity = generateSigningIdentity();
const webhookSecret = "route-test-webhook-secret-with-enough-entropy";
const repository = "richardcastrogois/proofrail-evidence-firewall";
const observedAt = new Date().toISOString();
const tokenExpiresAt = new Date(Date.now() + 60 * 60_000).toISOString();

process.env.DATA_DIR = dataDir;
process.env.GITHUB_APP_ID = "12345";
process.env.GITHUB_INSTALLATION_ID = "42";
process.env.GITHUB_APP_PRIVATE_KEY_BASE64 = Buffer.from(appPrivateKeyPem).toString("base64");
process.env.GITHUB_WEBHOOK_SECRET = webhookSecret;
process.env.GITHUB_ALLOWED_REPOSITORIES = repository;
process.env.PROOFRAIL_AGENT_PUBLIC_KEYS_JSON = JSON.stringify({
  "agent-release-01": [agentIdentity.publicKeyPem],
});

const { JsonStore } = await import("./store");
const { registerRoutes } = await import("./routes");
const { ServiceAuthenticator, hashServiceToken } = await import(
  "./service-auth"
);
const app = Fastify({ bodyLimit: 256 * 1024 });
const serviceToken = randomBytes(32).toString("base64url");
const operatorToken = randomBytes(32).toString("base64url");
const executorToken = randomBytes(32).toString("base64url");
let dispatchCount = 0;
const stagingExecutor = {
  assertAllowed(input: { repository: string; environment: string }) {
    assert.equal(input.repository, repository);
    assert.equal(input.environment, "staging");
  },
  async dispatch(input: { requestId: string }) {
    dispatchCount += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return {
      externalReference: `github:test-run:${input.requestId}`,
    };
  },
};
const serviceAuthenticator = new ServiceAuthenticator({
  schemaVersion: 1,
  principals: [
    {
      id: "orchestrator-route-test",
      kind: "orchestrator",
      scopes: [
        "state:read",
        "github:verify-ci",
        "evidence:collect",
        "decision:evaluate",
      ],
      tokenSha256: hashServiceToken(serviceToken),
    },
    {
      id: "operator-route-test",
      kind: "operator",
      scopes: ["simulation:run"],
      tokenSha256: hashServiceToken(operatorToken),
    },
    {
      id: "executor-route-test",
      kind: "executor",
      scopes: ["state:read", "permit:execute"],
      tokenSha256: hashServiceToken(executorToken),
    },
  ],
  approverKeys: [],
});

function signature(body: string): string {
  return `sha256=${createHmac("sha256", webhookSecret).update(body).digest("hex")}`;
}

function workflowPayload(
  conclusion: "success" | "failure",
  commitSha: string,
): string {
  return JSON.stringify({
    action: "completed",
    installation: { id: 42 },
    repository: { full_name: repository },
    workflow_run: {
      id: 101,
      name: "release",
      head_sha: commitSha,
      status: "completed",
      conclusion,
      html_url: "https://github.com/richardcastrogois/proofrail-evidence-firewall/actions/runs/101",
      updated_at: observedAt,
    },
  });
}

try {
  const store = new JsonStore();
  await store.init();
  await registerRoutes(app, store, serviceAuthenticator, stagingExecutor);

  const storedAction = (await store.read()).defaultAction;
  const action = {
    ...storedAction,
    value: 40,
    deployment: {
      ...storedAction.deployment!,
      riskScore: 40,
    },
  };
  assert.ok(action.deployment);
  const deliveryId = randomUUID();
  const body = workflowPayload("success", action.deployment.commitSha);
  const headers = {
    "content-type": "application/json",
    "x-github-event": "workflow_run",
    "x-github-delivery": deliveryId,
    "x-hub-signature-256": signature(body),
  };

  const first = await app.inject({
    method: "POST",
    url: "/api/integrations/github/webhook",
    headers,
    payload: body,
  });
  assert.equal(first.statusCode, 200);
  assert.equal(first.json().duplicate, false);

  const replay = await app.inject({
    method: "POST",
    url: "/api/integrations/github/webhook",
    headers,
    payload: body,
  });
  assert.equal(replay.statusCode, 200);
  assert.equal(replay.json().duplicate, true);

  const changedBody = workflowPayload("failure", action.deployment.commitSha);
  const collision = await app.inject({
    method: "POST",
    url: "/api/integrations/github/webhook",
    headers: {
      ...headers,
      "x-hub-signature-256": signature(changedBody),
    },
    payload: changedBody,
  });
  assert.equal(collision.statusCode, 409);
  assert.match(collision.json().error, /collision/i);

  const invalidHmac = await app.inject({
    method: "POST",
    url: "/api/integrations/github/webhook",
    headers: { ...headers, "x-hub-signature-256": "sha256=invalid" },
    payload: body,
  });
  assert.equal(invalidHmac.statusCode, 401);

  assert.equal((await store.read()).githubDeliveries.length, 1);

  const { agentActionSigningPayload } = await import("./github");
  const actionSignature = signCanonical(
    agentActionSigningPayload(action),
    agentIdentity.privateKeyPem,
  );
  const originalFetch = globalThis.fetch;
  let githubRequestCount = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    githubRequestCount += 1;
    const url = String(input);
    if (url.includes("/access_tokens")) {
      return new Response(
        JSON.stringify({
          token: "github-installation-token-for-route-tests",
          expires_at: tokenExpiresAt,
        }),
      );
    }
    if (url.endsWith("/actions/runs/101")) {
      return new Response(
        JSON.stringify({
          id: 101,
          name: "release",
          head_sha: action.deployment!.commitSha,
          status: "completed",
          conclusion: "success",
          html_url: "https://github.com/richardcastrogois/proofrail-evidence-firewall/actions/runs/101",
          updated_at: observedAt,
        }),
      );
    }
    if (url.includes("/actions/runs/101/artifacts")) {
      return new Response(
        JSON.stringify({
          artifacts: [
            {
              id: 202,
              name: "release-bundle",
              digest: action.deployment!.artifactDigest,
              expired: false,
              updated_at: observedAt,
              workflow_run: {
                id: 101,
                head_sha: action.deployment!.commitSha,
              },
            },
          ],
        }),
      );
    }
    return new Response(JSON.stringify({ message: "not found" }), { status: 404 });
  }) as typeof fetch;

  try {
    const verifyHeaders = {
      "content-type": "application/json",
      authorization: `Bearer ${serviceToken}`,
      "x-proofrail-agent-signature": actionSignature,
    };
    const verified = await app.inject({
      method: "POST",
      url: "/api/integrations/github/verify-ci",
      headers: verifyHeaders,
      payload: { action, deliveryId },
    });
    assert.equal(verified.statusCode, 200);
    assert.equal(verified.json().reused, false);
    assert.equal(githubRequestCount, 3);

    const reused = await app.inject({
      method: "POST",
      url: "/api/integrations/github/verify-ci",
      headers: verifyHeaders,
      payload: { action, deliveryId },
    });
    assert.equal(reused.statusCode, 200);
    assert.equal(reused.json().reused, true);
    assert.equal(githubRequestCount, 3, "a valid signed receipt should be reused");

    await store.update((database) => {
      const receipt = database.evidence.find(
        (entry) => entry.sourceId === "ci-agent-deploy",
      );
      assert.ok(receipt);
      receipt.signature = "tampered-signature";
    });
    const afterTampering = await app.inject({
      method: "POST",
      url: "/api/integrations/github/verify-ci",
      headers: verifyHeaders,
      payload: { action, deliveryId },
    });
    assert.equal(afterTampering.statusCode, 200);
    assert.equal(afterTampering.json().reused, false);
    assert.equal(githubRequestCount, 6, "a tampered receipt must be verified again at GitHub");

    const simulation = await app.inject({
      method: "POST",
      url: "/api/simulation/run",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${operatorToken}`,
      },
      payload: action,
    });
    assert.equal(simulation.statusCode, 200);
    assert.equal(simulation.json().execution, null);
    const permitId = simulation.json().decision.permit?.id as
      | string
      | undefined;
    assert.ok(permitId);

    const missingIdempotency = await app.inject({
      method: "POST",
      url: "/api/execute",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${executorToken}`,
      },
      payload: { permitId },
    });
    assert.equal(
      missingIdempotency.statusCode,
      400,
      missingIdempotency.body,
    );
    assert.equal(missingIdempotency.json().error.code, "INVALID_REQUEST");

    const idempotencyKey = randomUUID();
    const executeHeaders = {
      "content-type": "application/json",
      authorization: `Bearer ${executorToken}`,
      "idempotency-key": idempotencyKey,
    };
    const firstExecutionPromise = app.inject({
      method: "POST",
      url: "/api/execute",
      headers: executeHeaders,
      payload: { permitId },
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    const concurrentReplay = await app.inject({
      method: "POST",
      url: "/api/execute",
      headers: executeHeaders,
      payload: { permitId },
    });
    const firstExecution = await firstExecutionPromise;
    assert.equal(firstExecution.statusCode, 201);
    assert.equal(firstExecution.json().status, "succeeded");
    assert.equal(concurrentReplay.statusCode, 200);
    assert.match(concurrentReplay.json().status, /executing|succeeded/);
    assert.equal(dispatchCount, 1);

    const completedReplay = await app.inject({
      method: "POST",
      url: "/api/execute",
      headers: executeHeaders,
      payload: { permitId },
    });
    assert.equal(completedReplay.statusCode, 200);
    assert.equal(completedReplay.json().status, "succeeded");
    assert.equal(dispatchCount, 1);

    const secondKey = await app.inject({
      method: "POST",
      url: "/api/execute",
      headers: {
        ...executeHeaders,
        "idempotency-key": randomUUID(),
      },
      payload: { permitId },
    });
    assert.equal(secondKey.statusCode, 409);
    assert.equal(
      secondKey.json().error.code,
      "PERMIT_ALREADY_CONSUMED",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("Proofrail GitHub webhook route self-test passed");
} finally {
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
