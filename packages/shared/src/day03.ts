import { z } from "zod";

const IdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const CommitmentSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const ServiceScopeSchema = z.enum([
  "state:read",
  "scenario:select",
  "network:select",
  "github:verify-ci",
  "evidence:collect",
  "decision:evaluate",
  "approval:create",
  "permit:execute",
  "evidence:expire",
  "evidence:raw:read",
  "simulation:run",
  "system:reset",
]);
export type ServiceScope = z.infer<typeof ServiceScopeSchema>;

export const ServicePrincipalKindSchema = z.enum([
  "orchestrator",
  "approver",
  "executor",
  "operator",
]);
export type ServicePrincipalKind = z.infer<
  typeof ServicePrincipalKindSchema
>;

export const SERVICE_SCOPE_CEILINGS = {
  orchestrator: [
    "state:read",
    "github:verify-ci",
    "evidence:collect",
    "decision:evaluate",
  ],
  approver: ["state:read", "approval:create"],
  executor: ["state:read", "permit:execute"],
  operator: [
    "state:read",
    "scenario:select",
    "network:select",
    "evidence:expire",
    "evidence:raw:read",
    "simulation:run",
    "system:reset",
  ],
} as const satisfies Record<
  ServicePrincipalKind,
  readonly ServiceScope[]
>;

export const ServicePrincipalSchema = z
  .object({
    id: IdentifierSchema,
    kind: ServicePrincipalKindSchema,
    scopes: z.array(ServiceScopeSchema).min(1),
  })
  .strict()
  .superRefine((principal, context) => {
    if (new Set(principal.scopes).size !== principal.scopes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scopes"],
        message: "Service scopes must be unique",
      });
    }

    const ceiling = new Set<ServiceScope>(
      SERVICE_SCOPE_CEILINGS[principal.kind],
    );
    for (const scope of principal.scopes) {
      if (!ceiling.has(scope)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scopes"],
          message: `${principal.kind} principals cannot receive ${scope}`,
        });
      }
    }
  });
export type ServicePrincipal = z.infer<typeof ServicePrincipalSchema>;

export const ApprovalPayloadSchema = z
  .object({
    schemaVersion: z.literal(1),
    decisionId: z.string().uuid(),
    requestId: z.string().uuid(),
    actionCommitment: CommitmentSchema,
    evidenceRoot: CommitmentSchema,
    policyCommitment: CommitmentSchema,
    approverId: IdentifierSchema,
    approverKeyId: IdentifierSchema,
    approvedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict()
  .superRefine((approval, context) => {
    if (
      new Date(approval.approvedAt).getTime() >=
      new Date(approval.expiresAt).getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Approval must expire after it is issued",
      });
    }
  });
export type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;

export const CreateApprovalRequestSchema = z
  .object({
    approval: ApprovalPayloadSchema,
    signature: z
      .string()
      .min(80)
      .max(128)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export type CreateApprovalRequest = z.infer<
  typeof CreateApprovalRequestSchema
>;

export const ApprovalRecordSchema = z
  .object({
    id: z.string().uuid(),
    approval: ApprovalPayloadSchema,
    signature: CreateApprovalRequestSchema.shape.signature,
    recordedAt: z.string().datetime(),
  })
  .strict();
export type ApprovalRecord = z.infer<typeof ApprovalRecordSchema>;

export const IdempotencyKeySchema = z.string().uuid();
export type IdempotencyKey = z.infer<typeof IdempotencyKeySchema>;

export const ExecutePermitRequestSchema = z
  .object({
    permitId: z.string().uuid(),
  })
  .strict();
export type ExecutePermitRequest = z.infer<
  typeof ExecutePermitRequestSchema
>;

export const ExecutionStatusSchema = z.enum([
  "pending",
  "executing",
  "succeeded",
  "failed",
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

export const ApiErrorCodeSchema = z.enum([
  "AUTHENTICATION_REQUIRED",
  "INVALID_CREDENTIALS",
  "INSUFFICIENT_SCOPE",
  "INVALID_REQUEST",
  "APPROVER_NOT_INDEPENDENT",
  "INVALID_APPROVAL_SIGNATURE",
  "APPROVAL_CONFLICT",
  "IDEMPOTENCY_CONFLICT",
  "PERMIT_NOT_FOUND",
  "PERMIT_INVALID",
  "PERMIT_EXPIRED",
  "PERMIT_ALREADY_CONSUMED",
  "EXECUTION_NOT_ALLOWED",
  "EXECUTION_IN_PROGRESS",
  "EXECUTION_FAILED",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const ControlledExecutionSchema = z
  .object({
    id: z.string().uuid(),
    permitId: z.string().uuid(),
    requestId: z.string().uuid(),
    actionCommitment: CommitmentSchema,
    idempotencyKey: IdempotencyKeySchema,
    status: ExecutionStatusSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    startedAt: z.string().datetime().nullable(),
    finishedAt: z.string().datetime().nullable(),
    externalReference: z.string().trim().min(1).max(200).nullable(),
    failureCode: ApiErrorCodeSchema.nullable(),
  })
  .strict()
  .superRefine((execution, context) => {
    if (
      execution.status === "pending" &&
      (execution.startedAt !== null ||
        execution.finishedAt !== null ||
        execution.failureCode !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Pending executions cannot have started or finished fields",
      });
    }
    if (
      execution.status === "executing" &&
      (execution.startedAt === null ||
        execution.finishedAt !== null ||
        execution.failureCode !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Executing records require startedAt and cannot be finished",
      });
    }
    if (
      execution.status === "succeeded" &&
      (execution.startedAt === null ||
        execution.finishedAt === null ||
        execution.failureCode !== null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Succeeded records require start and finish without failure",
      });
    }
    if (
      execution.status === "failed" &&
      (execution.finishedAt === null || execution.failureCode === null)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Failed records require finishedAt and failureCode",
      });
    }
  });
export type ControlledExecution = z.infer<
  typeof ControlledExecutionSchema
>;

export const ApiErrorResponseSchema = z
  .object({
    error: z
      .object({
        code: ApiErrorCodeSchema,
        message: z.string().trim().min(1).max(500),
        requestId: z.string().uuid(),
      })
      .strict(),
  })
  .strict();
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
