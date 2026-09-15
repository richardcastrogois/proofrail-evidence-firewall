import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import {
  generateSigningIdentity,
  signCanonical,
} from "@rational/core";
import type {
  ApprovalPayload,
  PublicState,
} from "@rational/shared";
import {
  ServiceAuthenticator,
  hashServiceToken,
} from "./service-auth";

const dataDir = await mkdtemp(
  path.join(tmpdir(), "proofrail-approval-routes-"),
);
process.env.DATA_DIR = dataDir;

const orchestratorToken = randomBytes(32).toString("base64url");
const approverToken = randomBytes(32).toString("base64url");
const operatorToken = randomBytes(32).toString("base64url");
const approverIdentity = generateSigningIdentity();
const agentIdentity = generateSigningIdentity();
process.env.PROOFRAIL_AGENT_PUBLIC_KEYS_JSON = JSON.stringify({
  "agent-release-01": [agentIdentity.publicKeyPem],
});

const authenticator = new ServiceAuthenticator({
  schemaVersion: 1,
  principals: [
    {
      id: "orchestrator-local",
      kind: "orchestrator",
      scopes: [
        "state:read",
        "github:verify-ci",
        "evidence:collect",
        "decision:evaluate",
      ],
      tokenSha256: hashServiceToken(orchestratorToken),
    },
    {
      id: "human-reviewer-01",
      kind: "approver",
      scopes: ["state:read", "approval:create"],
      tokenSha256: hashServiceToken(approverToken),
    },
    {
      id: "operator-local",
      kind: "operator",
      scopes: [
        "state:read",
        "scenario:select",
        "network:select",
        "evidence:expire",
        "evidence:raw:read",
        "simulation:run",
        "system:reset",
      ],
      tokenSha256: hashServiceToken(operatorToken),
    },
  ],
  approverKeys: [
    {
      id: "approver-key-local",
      approverId: "human-reviewer-01",
      publicKeyPem: approverIdentity.publicKeyPem,
    },
  ],
});

function bearer(token: string) {
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
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
  assert.equal(action.scenarioId, "agent_deploy");
  assert.ok(action.deployment);

  const scenario = state.scenarios.find(
    (entry) => entry.id === "agent_deploy",
  )!;
  const requiredSources = scenario.sources.filter(
    (source) => source.role === "required",
  );
  assert.equal(requiredSources.length, 4);
  const approvalSource = scenario.sources.find(
    (source) => source.role === "review",
  )!;
  const genericApprovalBypass = await app.inject({
    method: "POST",
    url: "/api/evidence/collect",
    headers: bearer(orchestratorToken),
    payload: {
      sourceId: approvalSource.id,
      variant: "valid",
      action,
    },
  });
  assert.equal(genericApprovalBypass.statusCode, 403);
  assert.equal(
    genericApprovalBypass.json().error.code,
    "INSUFFICIENT_SCOPE",
  );
  for (const source of requiredSources) {
    const collected = await app.inject({
      method: "POST",
      url: "/api/evidence/collect",
      headers: bearer(orchestratorToken),
      payload: { sourceId: source.id, variant: "valid", action },
    });
    assert.equal(collected.statusCode, 200);
  }

  const reviewResponse = await app.inject({
    method: "POST",
    url: "/api/evaluate",
    headers: bearer(orchestratorToken),
    payload: action,
  });
  assert.equal(reviewResponse.statusCode, 200);
  const review = reviewResponse.json();
  assert.equal(review.status, "REVIEW_REQUIRED");
  const databaseAfterReview = await store.read();
  const reviewAnchor = databaseAfterReview.anchors.find(
    (entry) => entry.id === review.anchorId,
  )!;
  const approvedAt = new Date();
  const expiresAt = new Date(
    Math.min(
      approvedAt.getTime() + 10 * 60_000,
      Date.parse(reviewAnchor.validUntil) - 1_000,
    ),
  );
  const approval: ApprovalPayload = {
    schemaVersion: 1,
    decisionId: review.id,
    requestId: action.requestId,
    actionCommitment: review.actionCommitment,
    evidenceRoot: review.evidenceRoot,
    policyCommitment: review.policyCommitment,
    approverId: "human-reviewer-01",
    approverKeyId: "approver-key-local",
    approvedAt: approvedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const noApprovalScope = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(orchestratorToken),
    payload: {
      approval,
      signature: signCanonical(
        approval,
        approverIdentity.privateKeyPem,
      ),
    },
  });
  assert.equal(noApprovalScope.statusCode, 403);
  assert.equal(
    noApprovalScope.json().error.code,
    "INSUFFICIENT_SCOPE",
  );

  const selfApproval = {
    ...approval,
    approverId: action.deployment.agentId,
  };
  const selfApprovalResponse = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: {
      approval: selfApproval,
      signature: signCanonical(
        selfApproval,
        approverIdentity.privateKeyPem,
      ),
    },
  });
  assert.equal(selfApprovalResponse.statusCode, 403);
  assert.equal(
    selfApprovalResponse.json().error.code,
    "APPROVER_NOT_INDEPENDENT",
  );

  const alteredCommitment = {
    ...approval,
    actionCommitment: "f".repeat(64),
  };
  const alteredCommitmentResponse = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: {
      approval: alteredCommitment,
      signature: signCanonical(
        alteredCommitment,
        approverIdentity.privateKeyPem,
      ),
    },
  });
  assert.equal(alteredCommitmentResponse.statusCode, 422);
  assert.equal(
    alteredCommitmentResponse.json().error.code,
    "INVALID_REQUEST",
  );

  const invalidSignature = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: {
      approval,
      signature: signCanonical(
        approval,
        agentIdentity.privateKeyPem,
      ),
    },
  });
  assert.equal(invalidSignature.statusCode, 422);
  assert.equal(
    invalidSignature.json().error.code,
    "INVALID_APPROVAL_SIGNATURE",
  );

  process.env.PROOFRAIL_AGENT_PUBLIC_KEYS_JSON = JSON.stringify({
    "agent-release-01": [approverIdentity.publicKeyPem],
  });
  const sharedKey = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: {
      approval,
      signature: signCanonical(
        approval,
        approverIdentity.privateKeyPem,
      ),
    },
  });
  assert.equal(sharedKey.statusCode, 403);
  assert.equal(
    sharedKey.json().error.code,
    "APPROVER_NOT_INDEPENDENT",
  );
  process.env.PROOFRAIL_AGENT_PUBLIC_KEYS_JSON = JSON.stringify({
    "agent-release-01": [agentIdentity.publicKeyPem],
  });

  const signedApproval = {
    approval,
    signature: signCanonical(
      approval,
      approverIdentity.privateKeyPem,
    ),
  };
  const accepted = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: signedApproval,
  });
  assert.equal(accepted.statusCode, 201);
  assert.equal(accepted.json().reused, false);
  assert.equal(accepted.json().receipt.verified, true);

  const duplicate = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: signedApproval,
  });
  assert.equal(duplicate.statusCode, 200);
  assert.equal(duplicate.json().reused, true);
  assert.equal(duplicate.json().approval.id, accepted.json().approval.id);

  const conflictingApproval = {
    ...approval,
    expiresAt: new Date(expiresAt.getTime() - 1_000).toISOString(),
  };
  const conflict = await app.inject({
    method: "POST",
    url: "/api/approvals",
    headers: bearer(approverToken),
    payload: {
      approval: conflictingApproval,
      signature: signCanonical(
        conflictingApproval,
        approverIdentity.privateKeyPem,
      ),
    },
  });
  assert.equal(conflict.statusCode, 409);
  assert.equal(conflict.json().error.code, "APPROVAL_CONFLICT");

  const allowed = await app.inject({
    method: "POST",
    url: "/api/evaluate",
    headers: bearer(orchestratorToken),
    payload: action,
  });
  assert.equal(allowed.statusCode, 200);
  assert.equal(allowed.json().status, "ALLOW");
  assert.ok(allowed.json().permit);

  const finalDatabase = await store.read();
  assert.equal(finalDatabase.approvals.length, 1);
  assert.equal(
    finalDatabase.evidence.filter(
      (entry) => entry.sourceId === "approval-agent-deploy",
    ).length,
    1,
  );
  const publicStore = await readFile(
    path.join(dataDir, "store.json"),
    "utf8",
  );
  assert.doesNotMatch(publicStore, /BEGIN PRIVATE KEY/);

  console.log("Proofrail independent approval route self-test passed");
} finally {
  delete process.env.PROOFRAIL_AGENT_PUBLIC_KEYS_JSON;
  await app.close();
  await rm(dataDir, { recursive: true, force: true });
}
