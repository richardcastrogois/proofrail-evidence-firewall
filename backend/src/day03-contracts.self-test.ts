import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  ApiErrorResponseSchema,
  ApprovalPayloadSchema,
  ControlledExecutionSchema,
  CreateApprovalRequestSchema,
  ExecutePermitRequestSchema,
  IdempotencyKeySchema,
  ServicePrincipalSchema,
} from "@rational/shared";
import { ROUTE_ACCESS_RULES } from "./access-control";

const now = new Date();
const later = new Date(now.getTime() + 10 * 60_000);
const approval = {
  schemaVersion: 1 as const,
  decisionId: randomUUID(),
  requestId: randomUUID(),
  actionCommitment: "a".repeat(64),
  evidenceRoot: "b".repeat(64),
  policyCommitment: "c".repeat(64),
  approverId: "human-reviewer-01",
  approverKeyId: "approver-key-2026-01",
  approvedAt: now.toISOString(),
  expiresAt: later.toISOString(),
};
const signature = Buffer.alloc(64, 7).toString("base64");

assert.equal(
  ServicePrincipalSchema.safeParse({
    id: "orchestrator-local",
    kind: "orchestrator",
    scopes: ["state:read", "decision:evaluate"],
  }).success,
  true,
);
assert.equal(
  ServicePrincipalSchema.safeParse({
    id: "orchestrator-local",
    kind: "orchestrator",
    scopes: ["state:read", "state:read"],
  }).success,
  false,
  "duplicate scopes must fail closed",
);
assert.equal(
  ServicePrincipalSchema.safeParse({
    id: "approver-local",
    kind: "approver",
    scopes: ["permit:execute"],
  }).success,
  false,
  "an approver principal cannot receive executor authority",
);
assert.equal(
  ServicePrincipalSchema.safeParse({
    id: "executor-local",
    kind: "executor",
    scopes: ["shell:run"],
  }).success,
  false,
  "unknown scopes must be rejected",
);

assert.equal(ApprovalPayloadSchema.safeParse(approval).success, true);
assert.equal(
  ApprovalPayloadSchema.safeParse({
    ...approval,
    approvedAt: later.toISOString(),
    expiresAt: now.toISOString(),
  }).success,
  false,
  "an approval cannot expire before it is issued",
);
assert.equal(
  CreateApprovalRequestSchema.safeParse({
    approval,
    signature: "",
  }).success,
  false,
  "empty signatures must be rejected",
);
assert.equal(
  CreateApprovalRequestSchema.safeParse({
    approval,
    signature,
    publicKeyPem: "client-controlled-key",
  }).success,
  false,
  "the client cannot inject the trusted approver key",
);

const permitId = randomUUID();
assert.equal(
  ExecutePermitRequestSchema.safeParse({ permitId }).success,
  true,
);
assert.equal(
  ExecutePermitRequestSchema.safeParse({
    permitId,
    command: "deploy --force",
  }).success,
  false,
  "the executor request is closed and cannot carry commands",
);
assert.equal(
  IdempotencyKeySchema.safeParse("retry-the-deploy").success,
  false,
  "idempotency keys use an unambiguous UUID contract",
);

const executionBase = {
  id: randomUUID(),
  permitId,
  requestId: randomUUID(),
  actionCommitment: "d".repeat(64),
  idempotencyKey: randomUUID(),
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  externalReference: null,
};
assert.equal(
  ControlledExecutionSchema.safeParse({
    ...executionBase,
    status: "pending",
    startedAt: null,
    finishedAt: null,
    failureCode: null,
  }).success,
  true,
);
assert.equal(
  ControlledExecutionSchema.safeParse({
    ...executionBase,
    status: "succeeded",
    startedAt: null,
    finishedAt: later.toISOString(),
    failureCode: null,
  }).success,
  false,
  "a succeeded execution must record when external work started",
);
assert.equal(
  ControlledExecutionSchema.safeParse({
    ...executionBase,
    status: "failed",
    startedAt: null,
    finishedAt: later.toISOString(),
    failureCode: null,
  }).success,
  false,
  "a failed execution must expose a stable non-secret error code",
);

assert.equal(
  ApiErrorResponseSchema.safeParse({
    error: {
      code: "INSUFFICIENT_SCOPE",
      message: "The caller does not have approval:create",
      requestId: randomUUID(),
      token: "must-not-leak",
    },
  }).success,
  false,
  "error responses cannot grow secret-bearing fields",
);

const routeKeys = ROUTE_ACCESS_RULES.map(
  (rule) => `${rule.method} ${rule.path}`,
);
assert.equal(
  new Set(routeKeys).size,
  routeKeys.length,
  "route access rules must be unique",
);
for (const rule of ROUTE_ACCESS_RULES) {
  if (
    rule.method === "POST" &&
    rule.path !== "/api/integrations/github/webhook"
  ) {
    assert.equal(
      rule.authentication,
      "service",
      `${rule.method} ${rule.path} must require service authentication`,
    );
    assert.ok(rule.scope, `${rule.method} ${rule.path} must require a scope`);
  }
}
assert.deepEqual(
  ROUTE_ACCESS_RULES.find((rule) => rule.path === "/api/approvals"),
  {
    method: "POST",
    path: "/api/approvals",
    authentication: "service",
    scope: "approval:create",
  },
);
assert.deepEqual(
  ROUTE_ACCESS_RULES.find((rule) => rule.path === "/api/execute"),
  {
    method: "POST",
    path: "/api/execute",
    authentication: "service",
    scope: "permit:execute",
  },
);

console.log("Proofrail Day 03 API contracts self-test passed");
