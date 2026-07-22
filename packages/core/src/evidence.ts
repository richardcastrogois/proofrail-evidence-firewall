import type { EvidenceReceipt } from "@rational/shared";
import { verifyCanonical } from "./crypto";

export function evidenceSigningPayload(
  receipt: EvidenceReceipt,
): Omit<
  EvidenceReceipt,
  "signature" | "publicKeyPem" | "verified" | "lifecycle"
> {
  return {
    id: receipt.id,
    requestId: receipt.requestId,
    scenarioId: receipt.scenarioId,
    claimType: receipt.claimType,
    subjectId: receipt.subjectId,
    sourceId: receipt.sourceId,
    sourceClass: receipt.sourceClass,
    observedAt: receipt.observedAt,
    expiresAt: receipt.expiresAt,
    payloadCommitment: receipt.payloadCommitment,
    actionCommitment: receipt.actionCommitment,
    normalized: receipt.normalized,
  };
}

export function verifyEvidenceReceipt(
  receipt: EvidenceReceipt,
  expectedPublicKeyPem: string,
): boolean {
  if (
    receipt.signature === null ||
    receipt.publicKeyPem === null ||
    receipt.publicKeyPem !== expectedPublicKeyPem
  ) {
    return false;
  }

  return verifyCanonical(
    evidenceSigningPayload(receipt),
    receipt.signature,
    expectedPublicKeyPem,
  );
}
