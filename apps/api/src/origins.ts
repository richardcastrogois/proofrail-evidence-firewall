import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  canonicalStringify,
  createAesKeyBase64,
  encryptJson,
  evidenceSigningPayload,
  sha256Hex,
  signCanonical,
} from "@rational/core";
import type {
  ApprovalRecord,
  EvidenceReceipt,
  ProposedAction,
} from "@rational/shared";
import { rawDir } from "./store";
import type { GitHubCiVerification } from "./github";
import type { Database } from "./types";

export type EvidenceVariant = "valid" | "contradictory";

export interface DeclaredDocument {
  name: string;
  size: number;
  mimeType: string;
  sha256: string;
}

async function persistEncryptedRaw(
  id: string,
  raw: Record<string, unknown>,
): Promise<{
  encryptedPath: string;
  encryptionKeyBase64: string;
  originalBytes: number;
  encryptedBytes: number;
}> {
  const encryptionKeyBase64 = createAesKeyBase64();
  const envelope = encryptJson(raw, encryptionKeyBase64);
  const serialized = JSON.stringify(envelope);
  const encryptedPath = path.join(rawDir, `${id}.json`);
  await mkdir(rawDir, { recursive: true });
  await writeFile(encryptedPath, serialized, "utf8");
  return {
    encryptedPath,
    encryptionKeyBase64,
    originalBytes: Buffer.byteLength(canonicalStringify(raw), "utf8"),
    encryptedBytes: Buffer.byteLength(serialized, "utf8"),
  };
}

export async function createSignedEvidence(input: {
  database: Database;
  sourceId: string;
  action: ProposedAction;
  variant: EvidenceVariant;
  privateKeyPem: string;
}): Promise<EvidenceReceipt> {
  const origin = input.database.origins.find(
    (entry) => entry.id === input.sourceId,
  );
  if (!origin || origin.scenarioId !== input.action.scenarioId) {
    throw new Error("Unknown origin for the selected scenario");
  }

  const id = randomUUID();
  const observedAt = new Date();
  const status =
    input.variant === "valid"
      ? origin.validValue
      : origin.contradictoryValue;
  const normalized = {
    referenceId: input.action.referenceId,
    value:
      input.variant === "valid"
        ? input.action.value
        : input.action.value + 1,
    status,
  };
  const raw = {
    source: origin.name,
    scenarioId: input.action.scenarioId,
    requestId: input.action.requestId,
    subjectId: input.action.subjectId,
    referenceId: input.action.referenceId,
    value: normalized.value,
    unit: input.action.unit,
    claimType: origin.claimType,
    status,
    observedAt: observedAt.toISOString(),
  };
  const persisted = await persistEncryptedRaw(id, raw);

  const receipt: EvidenceReceipt = {
    id,
    requestId: input.action.requestId,
    scenarioId: input.action.scenarioId,
    claimType: origin.claimType,
    subjectId: input.action.subjectId,
    sourceId: origin.id,
    sourceClass: origin.sourceClass,
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(
      observedAt.getTime() + input.database.policy.maxAgeMinutes * 60_000,
    ).toISOString(),
    payloadCommitment: sha256Hex(raw),
    actionCommitment: sha256Hex(input.action),
    normalized,
    signature: null,
    publicKeyPem: origin.publicKeyPem,
    verified: false,
    lifecycle: {
      rawAvailable: true,
      rawExpiresAt: new Date(
        observedAt.getTime() + input.database.policy.rawRetentionSeconds * 1000,
      ).toISOString(),
      originalBytes: persisted.originalBytes,
      encryptedBytes: persisted.encryptedBytes,
      erasureMethod: "key_deletion",
    },
  };
  receipt.signature = signCanonical(
    evidenceSigningPayload(receipt),
    input.privateKeyPem,
  );
  input.database.evidenceSecrets[id] = {
    encryptedPath: persisted.encryptedPath,
    encryptionKeyBase64: persisted.encryptionKeyBase64,
  };
  return receipt;
}

export async function createGitHubCiEvidence(input: {
  database: Database;
  action: ProposedAction;
  verification: GitHubCiVerification;
  privateKeyPem: string;
}): Promise<EvidenceReceipt> {
  const origin = input.database.origins.find(
    (entry) =>
      entry.id === "ci-agent-deploy" &&
      entry.scenarioId === input.action.scenarioId,
  );
  if (!origin || !input.action.deployment) {
    throw new Error("GitHub CI origin is unavailable for this action");
  }

  const id = randomUUID();
  const observedAt = new Date(input.verification.observedAt);
  const raw = {
    provider: "github-actions",
    repository: input.verification.repository,
    commitSha: input.verification.commitSha,
    artifactDigest: input.verification.artifactDigest,
    workflowRunId: input.verification.workflowRunId,
    workflowName: input.verification.workflowName,
    artifactId: input.verification.artifactId,
    artifactName: input.verification.artifactName,
    status: "passed",
    observedAt: observedAt.toISOString(),
  };
  const persisted = await persistEncryptedRaw(id, raw);
  const receipt: EvidenceReceipt = {
    id,
    requestId: input.action.requestId,
    scenarioId: input.action.scenarioId,
    claimType: origin.claimType,
    subjectId: input.action.subjectId,
    sourceId: origin.id,
    sourceClass: origin.sourceClass,
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(
      observedAt.getTime() + input.database.policy.maxAgeMinutes * 60_000,
    ).toISOString(),
    payloadCommitment: sha256Hex(raw),
    actionCommitment: sha256Hex(input.action),
    normalized: {
      referenceId: input.action.referenceId,
      value: input.action.value,
      status: "passed",
      repository: input.verification.repository,
      artifactDigest: input.verification.artifactDigest,
      workflowRunId: input.verification.workflowRunId,
      workflowName: input.verification.workflowName,
      artifactId: input.verification.artifactId,
      artifactName: input.verification.artifactName,
    },
    signature: null,
    publicKeyPem: origin.publicKeyPem,
    verified: false,
    lifecycle: {
      rawAvailable: true,
      rawExpiresAt: new Date(
        observedAt.getTime() + input.database.policy.rawRetentionSeconds * 1000,
      ).toISOString(),
      originalBytes: persisted.originalBytes,
      encryptedBytes: persisted.encryptedBytes,
      erasureMethod: "key_deletion",
    },
  };
  receipt.signature = signCanonical(
    evidenceSigningPayload(receipt),
    input.privateKeyPem,
  );
  input.database.evidenceSecrets[id] = {
    encryptedPath: persisted.encryptedPath,
    encryptionKeyBase64: persisted.encryptionKeyBase64,
  };
  return receipt;
}

export async function createApprovalEvidence(input: {
  database: Database;
  action: ProposedAction;
  approval: ApprovalRecord;
  privateKeyPem: string;
}): Promise<EvidenceReceipt> {
  const origin = input.database.origins.find(
    (entry) =>
      entry.id === "approval-agent-deploy" &&
      entry.scenarioId === input.action.scenarioId,
  );
  if (!origin || !input.action.deployment) {
    throw new Error("Approval origin is unavailable for this action");
  }

  const id = randomUUID();
  const observedAt = new Date(input.approval.approval.approvedAt);
  const raw = {
    provider: "proofrail-human-approval",
    approvalId: input.approval.id,
    decisionId: input.approval.approval.decisionId,
    requestId: input.approval.approval.requestId,
    approverId: input.approval.approval.approverId,
    approverKeyId: input.approval.approval.approverKeyId,
    actionCommitment: input.approval.approval.actionCommitment,
    evidenceRoot: input.approval.approval.evidenceRoot,
    policyCommitment: input.approval.approval.policyCommitment,
    status: origin.validValue,
    approvedAt: input.approval.approval.approvedAt,
    expiresAt: input.approval.approval.expiresAt,
  };
  const persisted = await persistEncryptedRaw(id, raw);
  const policyExpiry = new Date(
    observedAt.getTime() +
      input.database.policy.maxAgeMinutes * 60_000,
  ).getTime();
  const approvalExpiry = new Date(
    input.approval.approval.expiresAt,
  ).getTime();
  const receipt: EvidenceReceipt = {
    id,
    requestId: input.action.requestId,
    scenarioId: input.action.scenarioId,
    claimType: origin.claimType,
    subjectId: input.action.subjectId,
    sourceId: origin.id,
    sourceClass: origin.sourceClass,
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(
      Math.min(policyExpiry, approvalExpiry),
    ).toISOString(),
    payloadCommitment: sha256Hex(raw),
    actionCommitment: sha256Hex(input.action),
    normalized: {
      referenceId: input.action.referenceId,
      value: input.action.value,
      status: origin.validValue,
      approverId: input.approval.approval.approverId,
      approvalId: input.approval.id,
    },
    signature: null,
    publicKeyPem: origin.publicKeyPem,
    verified: false,
    lifecycle: {
      rawAvailable: true,
      rawExpiresAt: new Date(
        observedAt.getTime() +
          input.database.policy.rawRetentionSeconds * 1000,
      ).toISOString(),
      originalBytes: persisted.originalBytes,
      encryptedBytes: persisted.encryptedBytes,
      erasureMethod: "key_deletion",
    },
  };
  receipt.signature = signCanonical(
    evidenceSigningPayload(receipt),
    input.privateKeyPem,
  );
  input.database.evidenceSecrets[id] = {
    encryptedPath: persisted.encryptedPath,
    encryptionKeyBase64: persisted.encryptionKeyBase64,
  };
  return receipt;
}

export async function createSelfDeclaredEvidence(input: {
  database: Database;
  action: ProposedAction;
  document?: DeclaredDocument;
}): Promise<EvidenceReceipt> {
  const id = randomUUID();
  const observedAt = new Date();
  const firstRequirement = input.database.policy.requiredClaims[0]!;
  const raw = {
    declaredBy: "user",
    requestId: input.action.requestId,
    scenarioId: input.action.scenarioId,
    subjectId: input.action.subjectId,
    referenceId: input.action.referenceId,
    value: input.action.value,
    unit: input.action.unit,
    status: firstRequirement.expectedValue,
    document: input.document ?? null,
  };
  const persisted = await persistEncryptedRaw(id, raw);
  input.database.evidenceSecrets[id] = {
    encryptedPath: persisted.encryptedPath,
    encryptionKeyBase64: persisted.encryptionKeyBase64,
  };
  return {
    id,
    requestId: input.action.requestId,
    scenarioId: input.action.scenarioId,
    claimType: firstRequirement.claimType,
    subjectId: input.action.subjectId,
    sourceId: "user-declaration",
    sourceClass: "self_declared",
    observedAt: observedAt.toISOString(),
    expiresAt: new Date(
      observedAt.getTime() + input.database.policy.maxAgeMinutes * 60_000,
    ).toISOString(),
    payloadCommitment: sha256Hex(raw),
    actionCommitment: sha256Hex(input.action),
    normalized: {
      referenceId: input.action.referenceId,
      value: input.action.value,
      status: firstRequirement.expectedValue,
    },
    signature: null,
    publicKeyPem: null,
    verified: false,
    lifecycle: {
      rawAvailable: true,
      rawExpiresAt: new Date(
        observedAt.getTime() + input.database.policy.rawRetentionSeconds * 1000,
      ).toISOString(),
      originalBytes: persisted.originalBytes,
      encryptedBytes: persisted.encryptedBytes,
      erasureMethod: "key_deletion",
    },
  };
}
