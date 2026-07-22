import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SCENARIOS, type EvidenceReceipt } from "@rational/shared";
import { evaluateEvidencePolicy } from "./policy";
import { sha256Hex } from "./crypto";

const now = new Date("2026-07-18T12:00:00.000Z");

function receiptFor(
  scenarioIndex: number,
  sourceIndex: number,
  status?: string,
): EvidenceReceipt {
  const scenario = SCENARIOS[scenarioIndex]!;
  const source = scenario.sources[sourceIndex]!;
  const action = scenario.defaultAction;

  return {
    id: `00000000-0000-4000-8000-${String(scenarioIndex * 100 + sourceIndex + 10).padStart(12, "0")}`,
    requestId: action.requestId,
    scenarioId: scenario.id,
    claimType: source.claimType,
    subjectId: action.subjectId,
    sourceId: source.id,
    sourceClass: source.sourceClass,
    observedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 60 * 60_000).toISOString(),
    payloadCommitment: String(sourceIndex + 1).repeat(64),
    actionCommitment: sha256Hex(action),
    normalized: {
      referenceId: action.referenceId,
      value: action.value,
      status: status ?? String(source.validValue),
    },
    signature: "demo",
    publicKeyPem: "demo",
    verified: true,
    lifecycle: {
      rawAvailable: true,
      rawExpiresAt: new Date(now.getTime() + 300_000).toISOString(),
      originalBytes: 100,
      encryptedBytes: 150,
      erasureMethod: "key_deletion",
    },
  };
}

for (const [scenarioIndex, scenario] of SCENARIOS.entries()) {
  const action = scenario.defaultAction;
  assert.equal(
    evaluateEvidencePolicy({
      action,
      policy: scenario.policy,
      evidence: [],
      now,
    }).status,
    "DENY",
    `${scenario.id}: empty evidence`,
  );

  const validEvidence = scenario.sources.map((_source, sourceIndex) =>
    receiptFor(scenarioIndex, sourceIndex),
  );
  const expected =
    action.value > scenario.policy.maxValueWithoutReview &&
    scenario.policy.reviewRequiredClaims.length === 0
      ? "REVIEW_REQUIRED"
      : "ALLOW";
  assert.equal(
    evaluateEvidencePolicy({
      action,
      policy: scenario.policy,
      evidence: validEvidence,
      now,
    }).status,
    expected,
    `${scenario.id}: valid evidence`,
  );

  const contradictory = [...validEvidence];
  contradictory[0] = receiptFor(
    scenarioIndex,
    0,
    String(scenario.sources[0]!.contradictoryValue),
  );
  assert.equal(
    evaluateEvidencePolicy({
      action,
      policy: scenario.policy,
      evidence: contradictory,
      now,
    }).status,
    "DENY",
    `${scenario.id}: contradictory evidence`,
  );

  const wrongRequest = { ...validEvidence[0]!, requestId: randomUUID() };
  assert.equal(
    evaluateEvidencePolicy({
      action,
      policy: scenario.policy,
      evidence: [wrongRequest, ...validEvidence.slice(1)],
      now,
    }).status,
    "DENY",
    `${scenario.id}: evidence replay`,
  );

  const wrongActionCommitment = {
    ...validEvidence[0]!,
    actionCommitment: "f".repeat(64),
  };
  assert.equal(
    evaluateEvidencePolicy({
      action,
      policy: scenario.policy,
      evidence: [wrongActionCommitment, ...validEvidence.slice(1)],
      now,
    }).status,
    "DENY",
    `${scenario.id}: action commitment binding`,
  );

  if (scenario.policy.reviewRequiredClaims.length > 0) {
    const withoutReview = validEvidence.filter(
      (receipt) =>
        !scenario.policy.reviewRequiredClaims.some(
          (requirement) =>
            requirement.claimType === receipt.claimType &&
            requirement.sourceClass === receipt.sourceClass,
        ),
    );
    assert.equal(
      evaluateEvidencePolicy({
        action,
        policy: scenario.policy,
        evidence: withoutReview,
        now,
      }).status,
      "REVIEW_REQUIRED",
      `${scenario.id}: missing responsible review`,
    );
  }
}

console.log(`Proofrail core self-test passed for ${SCENARIOS.length} scenarios.`);
