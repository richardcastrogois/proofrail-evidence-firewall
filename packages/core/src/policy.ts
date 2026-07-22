import { randomUUID } from "node:crypto";
import type {
  DecisionResult,
  EvidencePolicy,
  EvidenceReceipt,
  ProposedAction,
} from "@rational/shared";
import { canonicalStringify } from "./canonical";
import { sha256Hex } from "./crypto";
import { evidenceSigningPayload } from "./evidence";
import { merkleRoot } from "./merkle";

function isFresh(
  receipt: EvidenceReceipt,
  policy: EvidencePolicy,
  now: Date,
): boolean {
  const observedAt = new Date(receipt.observedAt).getTime();
  const expiresAt = new Date(receipt.expiresAt).getTime();
  const ageMs = now.getTime() - observedAt;

  return (
    Number.isFinite(observedAt) &&
    Number.isFinite(expiresAt) &&
    expiresAt >= now.getTime() &&
    ageMs >= 0 &&
    ageMs <= policy.maxAgeMinutes * 60_000
  );
}

function receiptMatchesAction(
  receipt: EvidenceReceipt,
  action: ProposedAction,
): boolean {
  return (
    receipt.requestId === action.requestId &&
    receipt.scenarioId === action.scenarioId &&
    receipt.subjectId === action.subjectId &&
    receipt.normalized.referenceId === action.referenceId &&
    receipt.actionCommitment === sha256Hex(action)
  );
}

export function evaluateEvidencePolicy(input: {
  action: ProposedAction;
  policy: EvidencePolicy;
  evidence: EvidenceReceipt[];
  now?: Date;
}): DecisionResult {
  const now = input.now ?? new Date();

  if (
    input.action.scenarioId !== input.policy.scenarioId ||
    input.action.type !== input.policy.actionType
  ) {
    throw new Error("Action does not match the selected evidence policy");
  }

  const relevant = input.evidence.filter((receipt) =>
    receiptMatchesAction(receipt, input.action),
  );
  const missingRequirements: string[] = [];
  const reviewMissingRequirements: string[] = [];
  const contradictions: string[] = [];
  const acceptedEvidenceIds = new Set<string>();
  const acceptedSourceIds = new Set<string>();

  function collectRequirements(
    requirements: EvidencePolicy["requiredClaims"],
    missing: string[],
  ): void {
    for (const requirement of requirements) {
      const candidates = relevant.filter(
        (receipt) =>
          receipt.claimType === requirement.claimType &&
          receipt.sourceClass === requirement.sourceClass &&
          receipt.verified &&
          isFresh(receipt, input.policy, now),
      );
      const matching = candidates.filter(
        (receipt) =>
          receipt.normalized[requirement.field] === requirement.expectedValue,
      );
      const conflicting = candidates.filter(
        (receipt) =>
          receipt.normalized[requirement.field] !== requirement.expectedValue,
      );

      for (const receipt of conflicting) {
        contradictions.push(
          `${receipt.sourceId} declarou ${requirement.field}=${String(
            receipt.normalized[requirement.field],
          )}; esperado=${String(requirement.expectedValue)}.`,
        );
      }

      if (matching.length === 0) {
        missing.push(
          `${requirement.claimType} por ${requirement.sourceClass}`,
        );
      } else {
        for (const receipt of matching) {
          acceptedEvidenceIds.add(receipt.id);
          acceptedSourceIds.add(receipt.sourceId);
        }
      }
    }
  }

  collectRequirements(input.policy.requiredClaims, missingRequirements);
  collectRequirements(
    input.policy.reviewRequiredClaims,
    reviewMissingRequirements,
  );

  for (const receipt of relevant.filter(
    (entry) => entry.verified && isFresh(entry, input.policy, now),
  )) {
    const value = receipt.normalized.value;
    if (typeof value === "number" && value !== input.action.value) {
      contradictions.push(
        `${receipt.sourceId} informou valor/risco ${value}; a ação propõe ${input.action.value}.`,
      );
    }
  }

  if (acceptedSourceIds.size < input.policy.minIndependentSources) {
    missingRequirements.push(
      `mínimo de ${input.policy.minIndependentSources} fontes independentes`,
    );
  }

  const deploymentEnvironment = input.action.deployment?.environment;
  const reviewRequired =
    input.action.value > input.policy.maxValueWithoutReview ||
    (deploymentEnvironment !== undefined &&
      input.policy.reviewRequiredEnvironments.includes(deploymentEnvironment));
  const maxValueExceeded =
    input.policy.maxValueAllowed !== undefined &&
    input.action.value > input.policy.maxValueAllowed;
  const requiredSources =
    input.policy.minIndependentSources +
    (reviewRequired ? input.policy.reviewRequiredClaims.length : 0);

  let status: DecisionResult["status"] = "ALLOW";
  const reasons: string[] = [];

  if (maxValueExceeded) {
    status = "DENY";
    reasons.push(
      `O valor/risco ultrapassa o limite máximo permitido de ${input.policy.maxValueAllowed} ${input.action.unit}.`,
    );
  } else if (
    missingRequirements.length > 0 ||
    (input.policy.denyOnContradiction && contradictions.length > 0)
  ) {
    status = "DENY";
    reasons.push(
      "A ação foi bloqueada porque o conjunto de evidências não satisfez a política.",
    );
  } else if (
    reviewRequired &&
    (input.policy.reviewRequiredClaims.length === 0 ||
      reviewMissingRequirements.length > 0)
  ) {
    status = "REVIEW_REQUIRED";
    reasons.push(
      "A ação exige revisão responsável antes de receber um permit.",
    );
  } else {
    reasons.push(
      "Todas as evidências obrigatórias foram verificadas, estão frescas, vinculadas à ação e sem contradições.",
    );
  }

  const selectedReceipts = relevant
    .filter((receipt) => acceptedEvidenceIds.has(receipt.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const leafValues = selectedReceipts.map((receipt) =>
    sha256Hex({
      payload: evidenceSigningPayload(receipt),
      signature: receipt.signature,
    }),
  );

  return {
    id: randomUUID(),
    status,
    action: input.action,
    reasons,
    missingRequirements: [
      ...new Set([
        ...missingRequirements,
        ...(reviewRequired ? reviewMissingRequirements : []),
      ]),
    ],
    contradictions: [...new Set(contradictions)],
    evidenceIds: selectedReceipts.map((receipt) => receipt.id),
    independentSources: acceptedSourceIds.size,
    requiredSources,
    evidenceRoot: merkleRoot(leafValues),
    policyCommitment: sha256Hex(input.policy),
    actionCommitment: sha256Hex(input.action),
    createdAt: now.toISOString(),
    permit: null,
    anchorId: null,
  };
}

export function calculatePersistentBytes(value: unknown): number {
  return Buffer.byteLength(canonicalStringify(value), "utf8");
}
