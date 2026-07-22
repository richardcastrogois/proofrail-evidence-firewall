import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { generateSigningIdentity, signCanonical } from "@rational/core";
import { scenarioById } from "@rational/shared";
import {
  GitHubAppClient,
  GitHubVerificationError,
  agentActionSigningPayload,
  createGitHubAppJwt,
  getGitHubIntegrationStatus,
  isGitHubObservationFresh,
  isSameGitHubWorkflowDelivery,
  parseGitHubWorkflowDelivery,
  verifyAgentActionSignature,
  verifyGitHubWebhookSignature,
  type GitHubRuntimeConfig,
  type GitHubWorkflowDelivery,
} from "./github";

const scenario = scenarioById("agent_deploy");
const action = {
  ...structuredClone(scenario.defaultAction),
  requestId: randomUUID(),
};
const deployment = action.deployment!;
const agentIdentity = generateSigningIdentity();
const agentSignature = signCanonical(
  agentActionSigningPayload(action),
  agentIdentity.privateKeyPem,
);

const freshnessNow = Date.parse("2026-07-20T12:15:00.000Z");
assert.equal(
  isGitHubObservationFresh({
    observedAt: "2026-07-20T12:05:00.000Z",
    maxAgeMinutes: 15,
    now: freshnessNow,
  }),
  true,
);
assert.equal(
  isGitHubObservationFresh({
    observedAt: "2026-07-20T11:59:59.000Z",
    maxAgeMinutes: 15,
    now: freshnessNow,
  }),
  false,
  "a stale workflow must not become reusable evidence",
);
assert.equal(
  isGitHubObservationFresh({
    observedAt: "2026-07-20T12:20:01.000Z",
    maxAgeMinutes: 15,
    now: freshnessNow,
  }),
  false,
  "a workflow beyond the clock-skew allowance must be rejected",
);

assert.equal(
  verifyAgentActionSignature({
    action,
    signature: agentSignature,
    publicKeys: { [deployment.agentId]: [agentIdentity.publicKeyPem] },
  }),
  true,
  "the registered agent must authenticate the exact action",
);
assert.equal(
  verifyAgentActionSignature({
    action: { ...action, value: action.value + 1 },
    signature: agentSignature,
    publicKeys: { [deployment.agentId]: [agentIdentity.publicKeyPem] },
  }),
  false,
  "an action mutation must invalidate the agent signature",
);

const webhookSecret = "a-test-secret-that-is-long-enough";
const workflowPayload = Buffer.from(
  JSON.stringify({
    action: "completed",
    installation: { id: 42 },
    repository: { full_name: deployment.repository },
    workflow_run: {
      id: 101,
      name: "release",
      head_sha: deployment.commitSha,
      status: "completed",
      conclusion: "success",
      html_url: "https://github.com/proofrail/proofrail-demo/actions/runs/101",
      updated_at: "2026-07-20T12:00:00.000Z",
    },
  }),
);
const webhookSignature = `sha256=${createHmac("sha256", webhookSecret)
  .update(workflowPayload)
  .digest("hex")}`;
assert.equal(
  verifyGitHubWebhookSignature(
    workflowPayload,
    webhookSignature,
    webhookSecret,
  ),
  true,
);
assert.equal(
  verifyGitHubWebhookSignature(
    Buffer.concat([workflowPayload, Buffer.from(" ")]),
    webhookSignature,
    webhookSecret,
  ),
  false,
  "the HMAC must bind the raw body byte-for-byte",
);

const delivery = parseGitHubWorkflowDelivery({
  rawBody: workflowPayload,
  event: "workflow_run",
  deliveryId: "00000000-0000-4000-8000-000000000042",
  receivedAt: new Date("2026-07-20T12:00:01.000Z"),
});
assert.equal(delivery.repository, deployment.repository);
assert.equal(delivery.commitSha, deployment.commitSha);
assert.equal(
  isSameGitHubWorkflowDelivery(delivery, {
    ...delivery,
    receivedAt: "2026-07-20T12:05:00.000Z",
  }),
  true,
  "a byte-identical webhook replay may arrive at a later time",
);
assert.equal(
  isSameGitHubWorkflowDelivery(delivery, {
    ...delivery,
    conclusion: "failure",
  }),
  false,
  "the same delivery ID must not hide a changed payload",
);

const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
const appPrivateKeyPem = rsa.privateKey.export({
  type: "pkcs8",
  format: "pem",
}).toString();
const config: GitHubRuntimeConfig = {
  appId: "12345",
  installationId: 42,
  privateKeyPem: appPrivateKeyPem,
  webhookSecret,
  allowedRepositories: [deployment.repository],
  requireWebhook: true,
  agentPublicKeys: { [deployment.agentId]: [agentIdentity.publicKeyPem] },
};
assert.equal(createGitHubAppJwt(config).split(".").length, 3);

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function githubFetch(artifactDigest = deployment.artifactDigest) {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const fetchMock = async (
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = String(input);
    requests.push({ url, init });
    if (url.includes("/access_tokens")) {
      return jsonResponse({
        token: "github-installation-token-for-tests",
        expires_at: "2026-07-20T13:00:00.000Z",
      });
    }
    if (url.endsWith("/actions/runs/101")) {
      return jsonResponse({
        id: 101,
        name: "release",
        head_sha: deployment.commitSha,
        status: "completed",
        conclusion: "success",
        html_url: "https://github.com/proofrail/proofrail-demo/actions/runs/101",
        updated_at: "2026-07-20T12:00:00.000Z",
      });
    }
    if (url.includes("/actions/runs/101/artifacts")) {
      return jsonResponse({
        artifacts: [
          {
            id: 202,
            name: "release-bundle",
            digest: artifactDigest,
            expired: false,
            updated_at: "2026-07-20T12:00:00.000Z",
            workflow_run: {
              id: 101,
              head_sha: deployment.commitSha,
            },
          },
        ],
      });
    }
    return jsonResponse({ message: "not found" }, 404);
  };
  return { fetchMock: fetchMock as typeof fetch, requests };
}

const positiveFetch = githubFetch();
const verification = await new GitHubAppClient(
  config,
  positiveFetch.fetchMock,
).verifyDeployment({ action, delivery });
assert.equal(verification.commitSha, deployment.commitSha);
assert.equal(verification.artifactDigest, deployment.artifactDigest);
assert.equal(positiveFetch.requests.length, 3);
assert.match(
  String(positiveFetch.requests[0]!.init?.body),
  /"actions":"read"/,
  "installation token must be scoped to Actions read",
);

const wrongDigestFetch = githubFetch(
  `sha256:${"0".repeat(64)}`,
);
await assert.rejects(
  () =>
    new GitHubAppClient(config, wrongDigestFetch.fetchMock).verifyDeployment({
      action,
      delivery,
    }),
  GitHubVerificationError,
  "a different artifact digest must be rejected",
);

const incompleteStatus = getGitHubIntegrationStatus({});
assert.equal(incompleteStatus.configured, false);
assert.ok(incompleteStatus.missingConfiguration.includes("GITHUB_APP_ID"));

const oversizedFetch = (async () =>
  new Response(JSON.stringify({ padding: "x".repeat(1_000_001) }), {
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;
await assert.rejects(
  () => new GitHubAppClient(config, oversizedFetch).verifyDeployment({ action, delivery }),
  GitHubVerificationError,
  "oversized GitHub responses must be rejected while streaming",
);

console.log("Proofrail GitHub integration self-test passed");
