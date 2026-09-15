import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { signCanonical } from "@rational/core";
import {
  ApprovalPayloadSchema,
  PublicStateSchema,
} from "@rational/shared";
import { z } from "zod";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.DATA_DIR ?? path.resolve(moduleDir, "../../data");
const secretsPath =
  process.env.PROOFRAIL_SERVICE_AUTH_SECRETS ??
  path.join(dataDir, "private", "service-auth-secrets.json");
const apiUrl =
  process.env.PROOFRAIL_API_URL ?? "http://127.0.0.1:3333";

const SecretsSchema = z
  .object({
    schemaVersion: z.literal(1),
    tokens: z.record(z.string().min(32)),
    approverIdentities: z.record(
      z
        .object({
          approverId: z.string().min(1),
          privateKeyPem: z.string().min(40),
        })
        .strict(),
    ),
  })
  .strict();

const secrets = SecretsSchema.parse(
  JSON.parse(await readFile(secretsPath, "utf8")),
);
const [approverKeyId, identity] =
  Object.entries(secrets.approverIdentities)[0] ?? [];
if (!approverKeyId || !identity) {
  throw new Error("No local approver identity is configured");
}
const token = secrets.tokens[identity.approverId];
if (!token) throw new Error("The approver service token is unavailable");
const authorization = `Bearer ${token}`;

const stateResponse = await fetch(`${apiUrl}/api/state`, {
  headers: { authorization },
});
if (!stateResponse.ok) {
  throw new Error(`Could not read Proofrail state: HTTP ${stateResponse.status}`);
}
const state = PublicStateSchema.parse(await stateResponse.json());
const requestedDecisionId = process.argv[2];
const decision = [...state.decisions]
  .reverse()
  .find(
    (entry) =>
      entry.status === "REVIEW_REQUIRED" &&
      (!requestedDecisionId || entry.id === requestedDecisionId),
  );
if (!decision) {
  throw new Error("No matching REVIEW_REQUIRED decision is available");
}
const anchor = state.anchors.find(
  (entry) => entry.id === decision.anchorId,
);
if (!anchor) throw new Error("The review decision anchor is unavailable");
const approvedAt = new Date();
const expiresAt = new Date(
  Math.min(
    approvedAt.getTime() + 10 * 60_000,
    Date.parse(anchor.validUntil) - 1_000,
  ),
);
const approval = ApprovalPayloadSchema.parse({
  schemaVersion: 1,
  decisionId: decision.id,
  requestId: decision.action.requestId,
  actionCommitment: decision.actionCommitment,
  evidenceRoot: decision.evidenceRoot,
  policyCommitment: decision.policyCommitment,
  approverId: identity.approverId,
  approverKeyId,
  approvedAt: approvedAt.toISOString(),
  expiresAt: expiresAt.toISOString(),
});
const response = await fetch(`${apiUrl}/api/approvals`, {
  method: "POST",
  headers: {
    authorization,
    "content-type": "application/json",
  },
  body: JSON.stringify({
    approval,
    signature: signCanonical(approval, identity.privateKeyPem),
  }),
});
const result = (await response.json()) as {
  approval?: { id?: string };
  receipt?: { id?: string };
  reused?: boolean;
  error?: { code?: string; message?: string };
};
if (!response.ok) {
  throw new Error(
    `${result.error?.code ?? `HTTP ${response.status}`}: ${result.error?.message ?? "Approval failed"}`,
  );
}
console.log(
  JSON.stringify(
    {
      approvalId: result.approval?.id,
      evidenceId: result.receipt?.id,
      reused: result.reused,
      decisionId: decision.id,
      requestId: decision.action.requestId,
    },
    null,
    2,
  ),
);
