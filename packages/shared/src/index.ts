import { z } from "zod";
import { ControlledExecutionSchema } from "./day03";

export const ScenarioIdSchema = z.enum([
  "agent_deploy",
  "supplier_payment",
  "credit_release",
  "contract_approval",
  "production_deploy",
  "insurance_claim",
  "supplier_compliance",
  "agent_action",
  "sensitive_data_access",
]);
export type ScenarioId = z.infer<typeof ScenarioIdSchema>;

export const ActionTypeSchema = z.enum([
  "authorize_agent_deploy",
  "approve_supplier_payment",
  "release_credit",
  "approve_contract",
  "deploy_to_production",
  "settle_insurance_claim",
  "approve_supplier_compliance",
  "authorize_agent_action",
  "authorize_sensitive_data_access",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const SourceClassSchema = z.enum([
  "self_declared",
  "signed_erp",
  "signed_logistics",
  "signed_registry",
  "signed_identity",
  "signed_credit_bureau",
  "signed_income",
  "signed_legal",
  "signed_compliance",
  "signed_budget",
  "signed_ci",
  "signed_security",
  "signed_approval",
  "signed_insurer",
  "signed_assessor",
  "signed_fraud_screen",
  "signed_tax_registry",
  "signed_sanctions",
  "signed_governance",
  "signed_tool_policy",
  "signed_dlp",
  "signed_data_owner",
]);
export type SourceClass = z.infer<typeof SourceClassSchema>;

export const DecisionStatusSchema = z.enum([
  "ALLOW",
  "DENY",
  "REVIEW_REQUIRED",
]);
export type DecisionStatus = z.infer<typeof DecisionStatusSchema>;

export const NetworkIdSchema = z.enum([
  "undeployed",
  "preview",
  "preprod",
]);
export type NetworkId = z.infer<typeof NetworkIdSchema>;

export const DeploymentEnvironmentSchema = z.enum([
  "staging",
  "production",
]);
export type DeploymentEnvironment = z.infer<
  typeof DeploymentEnvironmentSchema
>;

export const AgentDeploymentContextSchema = z.object({
  agentId: z.string().trim().min(1).max(120),
  taskId: z.string().trim().min(1).max(120),
  repository: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  commitSha: z.string().trim().regex(/^[0-9a-f]{40,64}$/),
  artifactDigest: z.string().trim().regex(/^sha256:[0-9a-f]{64}$/),
  serviceId: z.string().trim().min(1).max(120),
  environment: DeploymentEnvironmentSchema,
  requestedTool: z.literal("deploy"),
  riskScore: z.number().int().min(0).max(100),
  nonce: z.string().uuid(),
});
export type AgentDeploymentContext = z.infer<
  typeof AgentDeploymentContextSchema
>;

const ProposedActionBaseSchema = z.object({
  requestId: z.string().uuid(),
  scenarioId: ScenarioIdSchema,
  type: ActionTypeSchema,
  subjectId: z.string().trim().min(1).max(120),
  referenceId: z.string().trim().min(1).max(120),
  value: z.number().finite().nonnegative().max(1_000_000_000_000),
  unit: z.string().trim().min(1).max(20),
  deployment: AgentDeploymentContextSchema.optional(),
});

export const ProposedActionSchema = ProposedActionBaseSchema.superRefine(
  (action, context) => {
    const isAgentDeploy =
      action.scenarioId === "agent_deploy" ||
      action.type === "authorize_agent_deploy";

    if (isAgentDeploy && !action.deployment) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deployment"],
        message: "Agent deploy actions require deployment context",
      });
      return;
    }

    if (
      action.deployment &&
      (action.deployment.agentId !== action.subjectId ||
        action.deployment.commitSha !== action.referenceId ||
        action.deployment.riskScore !== action.value)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deployment"],
        message:
          "Deployment identity, commit and risk must match the proposed action",
      });
    }
  },
);
export type ProposedAction = z.infer<typeof ProposedActionSchema>;

export const EvidenceLifecycleSchema = z.object({
  rawAvailable: z.boolean(),
  rawExpiresAt: z.string().datetime(),
  originalBytes: z.number().nonnegative(),
  encryptedBytes: z.number().nonnegative(),
  erasureMethod: z.literal("key_deletion"),
});
export type EvidenceLifecycle = z.infer<typeof EvidenceLifecycleSchema>;

export const NormalizedValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);
export type NormalizedValue = z.infer<typeof NormalizedValueSchema>;

export const EvidenceReceiptSchema = z.object({
  id: z.string().uuid(),
  requestId: z.string().uuid(),
  scenarioId: ScenarioIdSchema,
  claimType: z.string().min(1).max(120),
  subjectId: z.string().min(1).max(120),
  sourceId: z.string().min(1).max(120),
  sourceClass: SourceClassSchema,
  observedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  payloadCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  actionCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  normalized: z.record(NormalizedValueSchema),
  signature: z.string().nullable(),
  publicKeyPem: z.string().nullable(),
  verified: z.boolean(),
  lifecycle: EvidenceLifecycleSchema,
});
export type EvidenceReceipt = z.infer<typeof EvidenceReceiptSchema>;

export const ClaimRequirementSchema = z.object({
  claimType: z.string(),
  sourceClass: SourceClassSchema,
  field: z.string(),
  expectedValue: NormalizedValueSchema,
});
export type ClaimRequirement = z.infer<typeof ClaimRequirementSchema>;

export const EvidencePolicySchema = z.object({
  id: z.string(),
  scenarioId: ScenarioIdSchema,
  name: z.string(),
  version: z.number().int().positive(),
  actionType: ActionTypeSchema,
  minIndependentSources: z.number().int().positive(),
  maxAgeMinutes: z.number().int().positive(),
  maxValueWithoutReview: z.number().nonnegative(),
  maxValueAllowed: z.number().nonnegative().optional(),
  denyOnContradiction: z.boolean(),
  rawRetentionSeconds: z.number().int().positive(),
  requiredClaims: z.array(ClaimRequirementSchema).min(1),
  reviewRequiredClaims: z.array(ClaimRequirementSchema),
  reviewRequiredEnvironments: z.array(DeploymentEnvironmentSchema),
});
export type EvidencePolicy = z.infer<typeof EvidencePolicySchema>;

export const ActionPermitSchema = z.object({
  id: z.string().uuid(),
  action: ProposedActionSchema,
  actionCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  evidenceRoot: z.string().regex(/^[0-9a-f]{64}$/),
  policyCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  policyVersion: z.number().int().positive(),
  anchorId: z.string().uuid(),
  anchorNetwork: z.string().min(1).max(80),
  contractAddress: z.string().nullable(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  signature: z.string(),
  publicKeyPem: z.string(),
});
export type ActionPermit = z.infer<typeof ActionPermitSchema>;

export const DecisionResultSchema = z.object({
  id: z.string().uuid(),
  status: DecisionStatusSchema,
  action: ProposedActionSchema,
  reasons: z.array(z.string()),
  missingRequirements: z.array(z.string()),
  contradictions: z.array(z.string()),
  evidenceIds: z.array(z.string().uuid()),
  independentSources: z.number().int().nonnegative(),
  requiredSources: z.number().int().positive(),
  evidenceRoot: z.string().regex(/^[0-9a-f]{64}$/),
  policyCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  actionCommitment: z.string().regex(/^[0-9a-f]{64}$/),
  createdAt: z.string().datetime(),
  permit: ActionPermitSchema.nullable(),
  anchorId: z.string().uuid().nullable(),
});
export type DecisionResult = z.infer<typeof DecisionResultSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  message: z.string(),
  createdAt: z.string().datetime(),
  metadata: z.record(z.unknown()).default({}),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const AnchorRecordSchema = z.object({
  id: z.string().uuid(),
  network: z.string(),
  txId: z.string().nullable(),
  contractAddress: z.string().nullable(),
  evidenceRoot: z.string(),
  policyCommitment: z.string(),
  policyVersion: z.number().int().positive().default(1),
  actionCommitment: z.string(),
  decision: DecisionStatusSchema,
  validUntil: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type AnchorRecord = z.infer<typeof AnchorRecordSchema>;

export const ScenarioFieldSchema = z.object({
  key: z.enum(["subjectId", "referenceId", "value"]),
  label: z.string(),
  help: z.string(),
  placeholder: z.string(),
  type: z.enum(["text", "number"]),
});

export const ScenarioSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  sourceClass: SourceClassSchema.exclude(["self_declared"]),
  claimType: z.string(),
  field: z.string(),
  validValue: NormalizedValueSchema,
  contradictoryValue: NormalizedValueSchema,
  role: z.enum(["required", "review"]),
});
export type ScenarioSource = z.infer<typeof ScenarioSourceSchema>;

export const ScenarioDefinitionSchema = z.object({
  id: ScenarioIdSchema,
  actionType: ActionTypeSchema,
  title: z.string(),
  shortTitle: z.string(),
  description: z.string(),
  outcome: z.string(),
  unit: z.string(),
  defaultAction: ProposedActionSchema,
  fields: z.array(ScenarioFieldSchema),
  policy: EvidencePolicySchema,
  sources: z.array(ScenarioSourceSchema),
});
export type ScenarioDefinition = z.infer<typeof ScenarioDefinitionSchema>;

export const NetworkStatusSchema = z.object({
  active: NetworkIdSchema,
  deployments: z.record(NetworkIdSchema, z.string().nullable()),
  faucets: z.record(NetworkIdSchema, z.string().nullable()),
});
export type NetworkStatus = z.infer<typeof NetworkStatusSchema>;

export const GitHubIntegrationStatusSchema = z.object({
  configured: z.boolean(),
  webhookConfigured: z.boolean(),
  agentIdentityConfigured: z.boolean(),
  requireWebhook: z.boolean(),
  allowedRepositories: z.array(z.string()),
  apiVersion: z.string(),
  missingConfiguration: z.array(z.string()),
});
export type GitHubIntegrationStatus = z.infer<
  typeof GitHubIntegrationStatusSchema
>;

export const PublicStateSchema = z.object({
  mode: z.enum(["local", "cli"]),
  selectedScenarioId: ScenarioIdSchema,
  scenarios: z.array(ScenarioDefinitionSchema),
  defaultAction: ProposedActionSchema,
  policy: EvidencePolicySchema,
  network: NetworkStatusSchema,
  integrations: z.object({
    github: GitHubIntegrationStatusSchema,
  }),
  origins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      scenarioId: ScenarioIdSchema,
      sourceClass: SourceClassSchema.exclude(["self_declared"]),
      publicKeyPem: z.string(),
    }),
  ),
  evidence: z.array(EvidenceReceiptSchema),
  decisions: z.array(DecisionResultSchema),
  anchors: z.array(AnchorRecordSchema),
  executions: z.array(ControlledExecutionSchema),
  audit: z.array(AuditEventSchema),
  metrics: z.object({
    originalRawBytes: z.number(),
    accessibleRawBytes: z.number(),
    persistentAnchorBytes: z.number(),
    reductionPercent: z.number(),
  }),
});
export type PublicState = z.infer<typeof PublicStateSchema>;

export * from "./day03";
export * from "./scenarios";
