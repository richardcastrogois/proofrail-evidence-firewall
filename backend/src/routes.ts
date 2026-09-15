import { createPublicKey, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  ActionPermitSchema,
  ControlledExecutionSchema,
  CreateApprovalRequestSchema,
  ExecutePermitRequestSchema,
  IdempotencyKeySchema,
  NetworkIdSchema,
  ProposedActionSchema,
  SCENARIOS,
  ScenarioIdSchema,
  scenarioById,
  type ApiErrorCode,
  type ProposedAction,
} from "@rational/shared";
import {
  calculatePersistentBytes,
  decryptJson,
  evaluateEvidencePolicy,
  sha256Hex,
  signCanonical,
  verifyCanonical,
  verifyEvidenceReceipt,
} from "@rational/core";
import { z } from "zod";
import { actionForScenario, auditEvent, type ProofrailStore } from "./store";
import {
  createGitHubCiEvidence,
  createApprovalEvidence,
  createSelfDeclaredEvidence,
  createSignedEvidence,
} from "./origins";
import {
  GitHubAppClient,
  GitHubConfigurationError,
  GitHubDeliveryCollisionError,
  GitHubVerificationError,
  getAgentPublicKeyRegistry,
  getGitHubIntegrationStatus,
  isGitHubObservationFresh,
  loadGitHubRuntimeConfig,
  isSameGitHubWorkflowDelivery,
  parseGitHubWorkflowDelivery,
  verifyAgentActionSignature,
  verifyGitHubWebhookSignature,
} from "./github";
import {
  createAnchorAdapter,
  getNetworkStatus,
  MidnightAnchorError,
  switchMidnightNetwork,
} from "./midnight-adapter";
import {
  registerServiceAuthentication,
  sendApiError,
  type ServiceAuthenticator,
} from "./service-auth";
import type { Database } from "./types";
import {
  DisabledStagingExecutor,
  ExecutionNotAllowedError,
  type StagingDispatch,
  type StagingExecutor,
} from "./executor";
import { isLimitedPublicApiMode } from "./runtime-config";

const CollectEvidenceSchema = z.object({
  sourceId: z.string().trim().min(1).max(120),
  variant: z.enum(["valid", "contradictory"]).default("valid"),
  action: ProposedActionSchema,
});

const DeclaredDocumentSchema = z.object({
  action: ProposedActionSchema,
  document: z.object({
    name: z.string().trim().min(1).max(180),
    size: z.number().int().nonnegative().max(10 * 1024 * 1024),
    mimeType: z.string().trim().min(1).max(120),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
  }),
});

const VerifyGitHubCiSchema = z.object({
  action: ProposedActionSchema,
  deliveryId: z.string().uuid().optional(),
});

class ApprovalRouteError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code:
      | "INVALID_REQUEST"
      | "APPROVER_NOT_INDEPENDENT"
      | "INVALID_APPROVAL_SIGNATURE"
      | "APPROVAL_CONFLICT",
    message: string,
  ) {
    super(message);
  }
}

class ExecutionRouteError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
  }
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isZodError(error: unknown): boolean {
  return (
    error instanceof z.ZodError ||
    (typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "ZodError")
  );
}

function normalizedPublicKey(publicKeyPem: string): string {
  return createPublicKey(publicKeyPem)
    .export({ type: "spki", format: "pem" })
    .toString()
    .trim();
}

function verifyAllEvidence(database: Database): void {
  for (const receipt of database.evidence) {
    if (receipt.sourceClass === "self_declared") {
      receipt.verified = false;
      continue;
    }
    const origin = database.origins.find(
      (entry) =>
        entry.id === receipt.sourceId &&
        entry.scenarioId === receipt.scenarioId,
    );
    receipt.verified =
      origin !== undefined &&
      verifyEvidenceReceipt(receipt, origin.publicKeyPem);
  }
}

function reusableGitHubCiEvidence(
  database: Database,
  actionCommitment: string,
  now = Date.now(),
) {
  const origin = database.origins.find(
    (entry) =>
      entry.id === "ci-agent-deploy" && entry.scenarioId === "agent_deploy",
  );
  if (!origin) return undefined;
  return database.evidence.find(
    (entry) =>
      entry.sourceId === origin.id &&
      entry.scenarioId === "agent_deploy" &&
      entry.sourceClass === "signed_ci" &&
      entry.claimType === origin.claimType &&
      entry.actionCommitment === actionCommitment &&
      new Date(entry.expiresAt).getTime() >= now &&
      verifyEvidenceReceipt(entry, origin.publicKeyPem),
  );
}

async function publicState(database: Database) {
  const requestId = database.defaultAction.requestId;
  const evidence = database.evidence.filter(
    (entry) => entry.requestId === requestId,
  );
  const decisions = database.decisions.filter(
    (entry) => entry.action.requestId === requestId,
  );
  const anchorIds = new Set(decisions.map((entry) => entry.anchorId));
  const anchors = database.anchors.filter((entry) => anchorIds.has(entry.id));
  const permitIds = new Set(
    decisions.flatMap((entry) => (entry.permit ? [entry.permit.id] : [])),
  );
  const executions = database.executions.filter((entry) =>
    permitIds.has(entry.permitId),
  );
  const originalRawBytes = evidence.reduce(
    (total, receipt) => total + receipt.lifecycle.originalBytes,
    0,
  );
  const accessibleRawBytes = evidence.reduce(
    (total, receipt) =>
      total + (receipt.lifecycle.rawAvailable ? receipt.lifecycle.originalBytes : 0),
    0,
  );
  const persistentAnchorBytes = calculatePersistentBytes(
    anchors.map((anchor) => ({
      evidenceRoot: anchor.evidenceRoot,
      policyCommitment: anchor.policyCommitment,
      actionCommitment: anchor.actionCommitment,
      decision: anchor.decision,
      validUntil: anchor.validUntil,
    })),
  );
  const reductionPercent =
    originalRawBytes === 0
      ? 0
      : Math.max(0, (1 - persistentAnchorBytes / originalRawBytes) * 100);

  return {
    mode:
      (process.env.MIDNIGHT_MODE ?? "local") === "cli" ? "cli" : "local",
    selectedScenarioId: database.selectedScenarioId,
    scenarios: SCENARIOS,
    defaultAction: database.defaultAction,
    policy: database.policy,
    network: await getNetworkStatus(),
    integrations: {
      github: getGitHubIntegrationStatus(),
    },
    origins: database.origins
      .filter((origin) => origin.scenarioId === database.selectedScenarioId)
      .map(({ claimType: _claim, field: _field, validValue: _valid, contradictoryValue: _bad, ...origin }) => origin),
    evidence,
    decisions,
    anchors,
    executions,
    audit: [...database.audit].reverse(),
    metrics: {
      originalRawBytes,
      accessibleRawBytes,
      persistentAnchorBytes,
      reductionPercent,
    },
  };
}

function ensureSelectedAction(database: Database, action: ProposedAction): void {
  if (action.scenarioId !== database.selectedScenarioId) {
    throw new Error("Action scenario does not match the selected scenario");
  }
  if (action.type !== database.policy.actionType) {
    throw new Error("Action type does not match the selected policy");
  }
}

function permitPayload(permit: z.infer<typeof ActionPermitSchema>) {
  return {
    id: permit.id,
    action: permit.action,
    actionCommitment: permit.actionCommitment,
    evidenceRoot: permit.evidenceRoot,
    policyCommitment: permit.policyCommitment,
    policyVersion: permit.policyVersion,
    anchorId: permit.anchorId,
    anchorNetwork: permit.anchorNetwork,
    contractAddress: permit.contractAddress,
    issuedAt: permit.issuedAt,
    expiresAt: permit.expiresAt,
  };
}

function executionDispatch(
  database: Database,
  permitId: string,
  executor: StagingExecutor,
  network: Awaited<ReturnType<typeof getNetworkStatus>>,
): StagingDispatch {
  const decision = database.decisions.find(
    (entry) => entry.permit?.id === permitId,
  );
  if (!decision?.permit || decision.status !== "ALLOW") {
    throw new ExecutionRouteError(
      404,
      "PERMIT_NOT_FOUND",
      "An ALLOW permit was not found",
    );
  }
  const permit = ActionPermitSchema.parse(decision.permit);
  if (
    permit.actionCommitment !== sha256Hex(permit.action) ||
    permit.actionCommitment !== decision.actionCommitment ||
    permit.evidenceRoot !== decision.evidenceRoot ||
    permit.policyCommitment !== decision.policyCommitment
  ) {
    throw new ExecutionRouteError(
      403,
      "PERMIT_INVALID",
      "The permit is not bound to the evaluated action and evidence",
    );
  }
  const anchor = database.anchors.find((entry) => entry.id === permit.anchorId);
  if (
    !anchor ||
    decision.anchorId !== permit.anchorId ||
    anchor.network !== permit.anchorNetwork ||
    anchor.contractAddress !== permit.contractAddress ||
    anchor.actionCommitment !== permit.actionCommitment ||
    anchor.evidenceRoot !== permit.evidenceRoot ||
    anchor.policyCommitment !== permit.policyCommitment ||
    anchor.policyVersion !== permit.policyVersion ||
    anchor.decision !== "ALLOW" ||
    anchor.validUntil !== permit.expiresAt
  ) {
    throw new ExecutionRouteError(
      403,
      "PERMIT_INVALID",
      "The permit is not bound to the persisted ALLOW anchor",
    );
  }
  if (
    permit.policyVersion !== database.policy.version ||
    permit.publicKeyPem !== database.fabricIdentity.publicKeyPem ||
    !verifyCanonical(
      permitPayload(permit),
      permit.signature,
      database.fabricIdentity.publicKeyPem,
    )
  ) {
    throw new ExecutionRouteError(
      403,
      "PERMIT_INVALID",
      "The permit signature or policy version is invalid",
    );
  }
  if (new Date(permit.expiresAt).getTime() < Date.now()) {
    throw new ExecutionRouteError(403, "PERMIT_EXPIRED", "The permit expired");
  }

  const action = permit.action;
  const deployment = action.deployment;
  if (
    action.scenarioId !== "agent_deploy" ||
    action.type !== "authorize_agent_deploy" ||
    !deployment ||
    deployment.environment !== "staging" ||
    deployment.requestedTool !== "deploy"
  ) {
    throw new ExecutionRouteError(
      403,
      "EXECUTION_NOT_ALLOWED",
      "Only the closed agent deployment action for staging can be executed",
    );
  }

  const localAnchor = permit.anchorNetwork === "local-simulator";
  const activeAddress =
    network.active === "undeployed"
      ? null
      : network.deployments[network.active];
  if (
    (localAnchor && (process.env.MIDNIGHT_MODE ?? "local") !== "local") ||
    (!localAnchor &&
      (network.active === "undeployed" ||
        permit.anchorNetwork !== network.active ||
        permit.contractAddress !== activeAddress))
  ) {
    throw new ExecutionRouteError(
      403,
      "PERMIT_INVALID",
      "The permit anchor does not match the active Midnight deployment",
    );
  }

  const ciOrigin = database.origins.find(
    (entry) =>
      entry.id === "ci-agent-deploy" && entry.scenarioId === "agent_deploy",
  );
  const ciEvidence = database.evidence.find(
    (entry) =>
      decision.evidenceIds.includes(entry.id) &&
      entry.sourceId === "ci-agent-deploy" &&
      entry.sourceClass === "signed_ci" &&
      entry.requestId === action.requestId &&
      entry.actionCommitment === permit.actionCommitment &&
      entry.verified &&
      ciOrigin !== undefined &&
      verifyEvidenceReceipt(entry, ciOrigin.publicKeyPem) &&
      entry.normalized.repository === deployment.repository &&
      entry.normalized.artifactDigest === deployment.artifactDigest &&
      typeof entry.normalized.workflowRunId === "number" &&
      typeof entry.normalized.workflowName === "string" &&
      typeof entry.normalized.artifactId === "number" &&
      typeof entry.normalized.artifactName === "string",
  );
  if (!ciEvidence) {
    throw new ExecutionRouteError(
      403,
      "PERMIT_INVALID",
      "The permit lacks verified GitHub CI artifact provenance",
    );
  }

  const dispatch: StagingDispatch = {
    repository: deployment.repository,
    commitSha: deployment.commitSha,
    artifactDigest: deployment.artifactDigest,
    artifactId: ciEvidence.normalized.artifactId as number,
    artifactName: ciEvidence.normalized.artifactName as string,
    workflowRunId: ciEvidence.normalized.workflowRunId as number,
    serviceId: deployment.serviceId,
    environment: "staging",
    requestedTool: "deploy",
    requestId: action.requestId,
    permitId: permit.id,
  };
  try {
    executor.assertAllowed(dispatch);
  } catch (error) {
    if (error instanceof ExecutionNotAllowedError) {
      throw new ExecutionRouteError(
        403,
        "EXECUTION_NOT_ALLOWED",
        error.message,
      );
    }
    throw error;
  }
  return dispatch;
}

function expireRequestEvidence(database: Database, requestId: string): number {
  let expired = 0;
  for (const receipt of database.evidence) {
    if (receipt.requestId !== requestId) continue;
    const secret = database.evidenceSecrets[receipt.id];
    if (receipt.lifecycle.rawAvailable && secret?.encryptionKeyBase64) {
      delete secret.encryptionKeyBase64;
      receipt.lifecycle.rawAvailable = false;
      expired += 1;
    }
  }
  database.audit.push(
    auditEvent(
      "CRYPTOGRAPHIC_ERASURE",
      `${expired} chaves de evidência foram destruídas.`,
      { expired, requestId },
    ),
  );
  return expired;
}

export async function registerRoutes(
  app: FastifyInstance,
  store: ProofrailStore,
  serviceAuthenticator: ServiceAuthenticator,
  stagingExecutor: StagingExecutor = new DisabledStagingExecutor(),
): Promise<void> {
  registerServiceAuthentication(app, serviceAuthenticator);
  const limitedPublicApi = isLimitedPublicApiMode();

  function workerUnavailable(request: FastifyRequest, reply: FastifyReply) {
    return sendApiError(
      request,
      reply,
      503,
      "ANCHOR_UNAVAILABLE",
      "This public API is running in limited mode. Midnight anchoring, network switching, approvals and execution require the asynchronous worker.",
    );
  }

  async function evaluateAndPersist(action: ProposedAction, request?: FastifyRequest) {
    const database = await store.read();
    ensureSelectedAction(database, action);
    verifyAllEvidence(database);
    const decision = evaluateEvidencePolicy({
      action,
      policy: database.policy,
      evidence: database.evidence,
    });
    const anchorStartedAt = Date.now();
    request?.log.info(
      {
        operation: "midnight.anchor",
        requestId: action.requestId,
        scenarioId: action.scenarioId,
        decision: decision.status,
        policyVersion: database.policy.version,
        evidenceCount: decision.evidenceIds.length,
        contradictionCount: decision.contradictions.length,
      },
      "Midnight anchor started",
    );
    let anchor;
    try {
      anchor = await createAnchorAdapter().anchor(
        decision,
        database.policy.version,
      );
    } catch (error) {
      request?.log.error(
        {
          operation: "midnight.anchor",
          requestId: action.requestId,
          durationMs: Date.now() - anchorStartedAt,
          code: error instanceof MidnightAnchorError ? error.code : "UNEXPECTED_ERROR",
          message: error instanceof Error ? error.message : "Unknown Midnight anchor error",
        },
        "Midnight anchor failed",
      );
      throw error;
    }
    request?.log.info(
      {
        operation: "midnight.anchor",
        requestId: action.requestId,
        durationMs: Date.now() - anchorStartedAt,
        network: anchor.network,
        transactionId: anchor.txId,
      },
      "Midnight anchor confirmed",
    );
    decision.anchorId = anchor.id;
    if (decision.status === "ALLOW") {
      const issuedAt = new Date().toISOString();
      const permitBase = {
        id: randomUUID(),
        action,
        actionCommitment: decision.actionCommitment,
        evidenceRoot: decision.evidenceRoot,
        policyCommitment: decision.policyCommitment,
        policyVersion: database.policy.version,
        anchorId: anchor.id,
        anchorNetwork: anchor.network,
        contractAddress: anchor.contractAddress,
        issuedAt,
        expiresAt: anchor.validUntil,
        signature: "",
        publicKeyPem: database.fabricIdentity.publicKeyPem,
      };
      decision.permit = {
        ...permitBase,
        signature: signCanonical(
          permitPayload(permitBase),
          await store.fabricPrivateKey(),
        ),
      };
    }
    await store.update((mutable) => {
      mutable.defaultAction = action;
      mutable.decisions.push(decision);
      mutable.anchors.push(anchor);
      mutable.audit.push(
        auditEvent(
          "ACTION_EVALUATED",
          `A ação recebeu decisão ${decision.status}.`,
          { decisionId: decision.id, anchorId: anchor.id, requestId: action.requestId },
        ),
      );
    });
    return decision;
  }

  function sendAnchorError(
    request: Parameters<typeof sendApiError>[0],
    reply: FastifyReply,
    error: MidnightAnchorError,
  ) {
    const timedOut = error.code === "MIDNIGHT_ANCHOR_TIMEOUT";
    return sendApiError(
      request,
      reply,
      timedOut ? 504 : 502,
      "ANCHOR_UNAVAILABLE",
      timedOut
        ? "A rede Midnight não confirmou a ancoragem dentro do limite. A transação pode ter sido submetida; consulte os logs e o estado público antes de repetir."
        : "A ancoragem Midnight falhou antes de confirmar o recibo. Consulte os logs [API] e tente novamente.",
    );
  }

  app.get("/api/health", async () => ({
    ok: true,
    service: "proofrail-api",
    apiMode: limitedPublicApi ? "limited" : "full",
    mode: process.env.MIDNIGHT_MODE ?? "local",
    network: (await getNetworkStatus()).active,
  }));

  await app.register(async (webhookApp) => {
    webhookApp.removeContentTypeParser("application/json");
    webhookApp.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_request, body, done) => done(null, body),
    );
    webhookApp.post(
      "/api/integrations/github/webhook",
      async (request, reply) => {
        try {
          const config = loadGitHubRuntimeConfig();
          const rawBody = Buffer.isBuffer(request.body)
            ? request.body
            : Buffer.from(String(request.body ?? ""), "utf8");
          if (
            !verifyGitHubWebhookSignature(
              rawBody,
              firstHeader(request.headers["x-hub-signature-256"]),
              config.webhookSecret,
            )
          ) {
            return reply.code(401).send({ error: "Invalid GitHub webhook signature" });
          }

          const event = firstHeader(request.headers["x-github-event"]);
          if (event === "ping") return { accepted: true, event: "ping" };
          const delivery = parseGitHubWorkflowDelivery({
            rawBody,
            event,
            deliveryId: firstHeader(request.headers["x-github-delivery"]),
          });
          if (!config.allowedRepositories.includes(delivery.repository)) {
            return reply.code(403).send({ error: "Repository is not allowed" });
          }
          if (delivery.installationId !== config.installationId) {
            return reply.code(403).send({ error: "Unexpected GitHub App installation" });
          }

          return await store.update((database) => {
            const existingDelivery = database.githubDeliveries.find(
              (entry) => entry.deliveryId === delivery.deliveryId,
            );
            if (existingDelivery) {
              if (!isSameGitHubWorkflowDelivery(existingDelivery, delivery)) {
                throw new GitHubDeliveryCollisionError(
                  "GitHub delivery ID collision: the replay payload changed",
                );
              }
              return { accepted: true, duplicate: true, deliveryId: delivery.deliveryId };
            }
            database.githubDeliveries.push(delivery);
            database.githubDeliveries = database.githubDeliveries.slice(-1_000);
            database.audit.push(
              auditEvent(
                "GITHUB_WORKFLOW_RECEIVED",
                `GitHub Actions informou ${delivery.conclusion ?? delivery.status} para o commit ${delivery.commitSha.slice(0, 12)}.`,
                {
                  deliveryId: delivery.deliveryId,
                  repository: delivery.repository,
                  commitSha: delivery.commitSha,
                  workflowRunId: delivery.workflowRunId,
                },
              ),
            );
            return { accepted: true, duplicate: false, deliveryId: delivery.deliveryId };
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const status =
            error instanceof GitHubConfigurationError
              ? 503
              : error instanceof GitHubDeliveryCollisionError
                ? 409
                : 400;
          return reply.code(status).send({ error: message });
        }
      },
    );
  });

  app.post("/api/integrations/github/verify-ci", async (request, reply) => {
    try {
      const input = VerifyGitHubCiSchema.parse(request.body);
      const config = loadGitHubRuntimeConfig();
      const signature = firstHeader(request.headers["x-proofrail-agent-signature"]);
      if (
        !verifyAgentActionSignature({
          action: input.action,
          signature,
          publicKeys: config.agentPublicKeys,
        })
      ) {
        return reply.code(401).send({ error: "Invalid agent action signature" });
      }

      const snapshot = await store.read();
      ensureSelectedAction(snapshot, input.action);
      const actionCommitment = sha256Hex(input.action);
      const existing = reusableGitHubCiEvidence(snapshot, actionCommitment);
      if (existing) return { receipt: existing, reused: true };

      const deployment = input.action.deployment!;
      const matchingDeliveries = snapshot.githubDeliveries.filter(
        (entry) =>
          entry.repository === deployment.repository.toLowerCase() &&
          entry.commitSha === deployment.commitSha &&
          (!input.deliveryId || entry.deliveryId === input.deliveryId),
      );
      const delivery = matchingDeliveries.at(-1);
      if (config.requireWebhook && !delivery) {
        return reply.code(409).send({
          error: "A matching signed GitHub workflow_run webhook is required",
        });
      }

      const verification = await new GitHubAppClient(config).verifyDeployment({
        action: input.action,
        delivery,
      });
      if (
        !isGitHubObservationFresh({
          observedAt: verification.observedAt,
          maxAgeMinutes: snapshot.policy.maxAgeMinutes,
        })
      ) {
        throw new GitHubVerificationError(
          "GitHub workflow run is outside the policy freshness window",
        );
      }
      const privateKeyPem = await store.originPrivateKey("ci-agent-deploy");
      const receipt = await store.update(async (database) => {
        ensureSelectedAction(database, input.action);
        const duplicate = reusableGitHubCiEvidence(database, actionCommitment);
        if (duplicate) return duplicate;
        database.defaultAction = input.action;
        const created = await createGitHubCiEvidence({
          database,
          action: input.action,
          verification,
          privateKeyPem,
        });
        const origin = database.origins.find(
          (entry) => entry.id === "ci-agent-deploy",
        )!;
        created.verified = verifyEvidenceReceipt(created, origin.publicKeyPem);
        database.evidence.push(created);
        database.audit.push(
          auditEvent(
            "GITHUB_CI_EVIDENCE_VERIFIED",
            `GitHub Actions comprovou o commit e o artefato exatos para ${verification.repository}.`,
            {
              evidenceId: created.id,
              repository: verification.repository,
              commitSha: verification.commitSha,
              artifactDigest: verification.artifactDigest,
              workflowRunId: verification.workflowRunId,
            },
          ),
        );
        return created;
      });
      return { receipt, reused: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status =
        error instanceof GitHubConfigurationError
          ? 503
          : error instanceof GitHubVerificationError
            ? 422
            : 400;
      return reply.code(status).send({ error: message });
    }
  });

  app.get("/api/state", async () => {
    const database = await store.read();
    verifyAllEvidence(database);
    return publicState(database);
  });

  app.post("/api/reset", async (request) => {
    const input = z.object({ scenarioId: ScenarioIdSchema.optional() }).optional().parse(request.body);
    const database = await store.reset(input?.scenarioId);
    return publicState(database);
  });

  app.post("/api/scenario/select", async (request) => {
    const { scenarioId } = z.object({ scenarioId: ScenarioIdSchema }).parse(request.body);
    const scenario = scenarioById(scenarioId);
    const database = await store.update((mutable) => {
      mutable.selectedScenarioId = scenarioId;
      mutable.defaultAction = actionForScenario(scenarioId);
      mutable.policy = structuredClone(scenario.policy);
      mutable.audit.push(
        auditEvent("SCENARIO_SELECTED", `Cenário alterado para ${scenario.title}.`, { scenarioId }),
      );
      return mutable;
    });
    return publicState(database);
  });

  app.post("/api/network/select", async (request, reply) => {
    if (limitedPublicApi) return workerUnavailable(request, reply);
    const { network } = z.object({ network: NetworkIdSchema }).parse(request.body);
    const status = await switchMidnightNetwork(network);
    await store.update((database) => {
      database.audit.push(
        auditEvent("NETWORK_SELECTED", `Rede Midnight alterada para ${network}.`, { network }),
      );
    });
    return status;
  });

  app.post("/api/evidence/self-declared", async (request) => {
    const action = ProposedActionSchema.parse(request.body);
    return store.update(async (database) => {
      ensureSelectedAction(database, action);
      database.defaultAction = action;
      const receipt = await createSelfDeclaredEvidence({ database, action });
      database.evidence.push(receipt);
      database.audit.push(
        auditEvent(
          "SELF_DECLARED_EVIDENCE",
          "Uma declaração foi registrada, mas não recebeu origem confiável.",
          { evidenceId: receipt.id, requestId: action.requestId },
        ),
      );
      return receipt;
    });
  });

  app.post("/api/evidence/document", async (request) => {
    const input = DeclaredDocumentSchema.parse(request.body);
    return store.update(async (database) => {
      ensureSelectedAction(database, input.action);
      database.defaultAction = input.action;
      const receipt = await createSelfDeclaredEvidence({
        database,
        action: input.action,
        document: input.document,
      });
      database.evidence.push(receipt);
      database.audit.push(
        auditEvent(
          "SELF_DECLARED_DOCUMENT",
          `O arquivo ${input.document.name} foi registrado como alegação, mas não foi aceito como evidência de origem.`,
          {
            evidenceId: receipt.id,
            requestId: input.action.requestId,
            documentSha256: input.document.sha256,
          },
        ),
      );
      return receipt;
    });
  });

  app.post("/api/evidence/collect", async (request, reply) => {
    if (limitedPublicApi) return workerUnavailable(request, reply);
    const input = CollectEvidenceSchema.parse(request.body);
    const configuredOrigin = (await store.read()).origins.find(
      (entry) =>
        entry.id === input.sourceId &&
        entry.scenarioId === input.action.scenarioId,
    );
    if (!configuredOrigin) {
      return sendApiError(
        request,
        reply,
        400,
        "INVALID_REQUEST",
        "The evidence origin is not configured for this scenario",
      );
    }
    if (configuredOrigin.sourceClass === "signed_approval") {
      return sendApiError(
        request,
        reply,
        403,
        "INSUFFICIENT_SCOPE",
        "Approval evidence can only be created by the approval endpoint",
      );
    }
    const privateKeyPem = await store.originPrivateKey(input.sourceId);
    return store.update(async (database) => {
      ensureSelectedAction(database, input.action);
      database.defaultAction = input.action;
      const receipt = await createSignedEvidence({
        database,
        ...input,
        privateKeyPem,
      });
      const origin = database.origins.find((entry) => entry.id === input.sourceId)!;
      receipt.verified = verifyEvidenceReceipt(receipt, origin.publicKeyPem);
      database.evidence.push(receipt);
      database.audit.push(
        auditEvent(
          "ORIGIN_EVIDENCE_COLLECTED",
          `${origin.name} emitiu uma evidência ${input.variant === "valid" ? "válida" : "contraditória"}.`,
          { evidenceId: receipt.id, sourceId: origin.id, verified: receipt.verified },
        ),
      );
      return receipt;
    });
  });

  app.post("/api/evaluate", async (request, reply) => {
    if (limitedPublicApi) return workerUnavailable(request, reply);
    try {
      return await evaluateAndPersist(
        ProposedActionSchema.parse(request.body),
        request,
      );
    } catch (error) {
      if (error instanceof MidnightAnchorError) {
        return sendAnchorError(request, reply, error);
      }
      throw error;
    }
  });

  app.post("/api/approvals", async (request, reply) => {
    if (limitedPublicApi) return workerUnavailable(request, reply);
    try {
      const input = CreateApprovalRequestSchema.parse(request.body);
      const principal = request.servicePrincipal;
      if (
        !principal ||
        principal.kind !== "approver" ||
        principal.id !== input.approval.approverId
      ) {
        throw new ApprovalRouteError(
          403,
          "APPROVER_NOT_INDEPENDENT",
          "The authenticated approver does not match the signed approval",
        );
      }
      const approverKey = serviceAuthenticator.approverKey(
        input.approval.approverKeyId,
        input.approval.approverId,
      );
      if (!approverKey) {
        throw new ApprovalRouteError(
          422,
          "INVALID_APPROVAL_SIGNATURE",
          "The approval key is not trusted for this approver",
        );
      }

      const snapshot = await store.read();
      const decision = snapshot.decisions.find(
        (entry) => entry.id === input.approval.decisionId,
      );
      if (
        !decision ||
        decision.status !== "REVIEW_REQUIRED" ||
        decision.action.requestId !== input.approval.requestId ||
        decision.actionCommitment !==
          input.approval.actionCommitment ||
        decision.evidenceRoot !== input.approval.evidenceRoot ||
        decision.policyCommitment !==
          input.approval.policyCommitment
      ) {
        throw new ApprovalRouteError(
          422,
          "INVALID_REQUEST",
          "The approval is not bound to the persisted review decision",
        );
      }
      const anchor = snapshot.anchors.find(
        (entry) => entry.id === decision.anchorId,
      );
      const now = Date.now();
      const approvedAt = Date.parse(input.approval.approvedAt);
      const expiresAt = Date.parse(input.approval.expiresAt);
      if (
        !anchor ||
        expiresAt > Date.parse(anchor.validUntil) ||
        expiresAt <= now ||
        approvedAt > now + 5 * 60_000
      ) {
        throw new ApprovalRouteError(
          422,
          "INVALID_REQUEST",
          "The approval validity is outside the review decision window",
        );
      }
      const agentId = decision.action.deployment?.agentId;
      if (
        !agentId ||
        agentId === input.approval.approverId
      ) {
        throw new ApprovalRouteError(
          403,
          "APPROVER_NOT_INDEPENDENT",
          "The requesting agent cannot approve its own action",
        );
      }
      const approverPublicKey = normalizedPublicKey(
        approverKey.publicKeyPem,
      );
      const agentKeys =
        getAgentPublicKeyRegistry()[agentId] ?? [];
      if (
        agentKeys.some(
          (key) => normalizedPublicKey(key) === approverPublicKey,
        )
      ) {
        throw new ApprovalRouteError(
          403,
          "APPROVER_NOT_INDEPENDENT",
          "The approver key cannot be registered to the requesting agent",
        );
      }
      if (
        !verifyCanonical(
          input.approval,
          input.signature,
          approverKey.publicKeyPem,
        )
      ) {
        throw new ApprovalRouteError(
          422,
          "INVALID_APPROVAL_SIGNATURE",
          "The approval signature is invalid",
        );
      }

      const originPrivateKey = await store.originPrivateKey(
        "approval-agent-deploy",
      );
      const result = await store.update(async (database) => {
        const currentDecision = database.decisions.find(
          (entry) => entry.id === input.approval.decisionId,
        );
        if (
          !currentDecision ||
          currentDecision.status !== "REVIEW_REQUIRED" ||
          currentDecision.actionCommitment !==
            input.approval.actionCommitment ||
          currentDecision.evidenceRoot !==
            input.approval.evidenceRoot ||
          currentDecision.policyCommitment !==
            input.approval.policyCommitment
        ) {
          throw new ApprovalRouteError(
            409,
            "APPROVAL_CONFLICT",
            "The review decision changed before approval persistence",
          );
        }
        const existing = database.approvals.find(
          (entry) =>
            entry.approval.decisionId ===
            input.approval.decisionId,
        );
        if (existing) {
          if (
            sha256Hex(existing) !==
            sha256Hex({
              ...existing,
              approval: input.approval,
              signature: input.signature,
            })
          ) {
            throw new ApprovalRouteError(
              409,
              "APPROVAL_CONFLICT",
              "A different approval already exists for this decision",
            );
          }
          const receipt = database.evidence.find(
            (entry) =>
              entry.normalized.approvalId === existing.id,
          );
          return { approval: existing, receipt, reused: true };
        }
        const approval = {
          id: randomUUID(),
          approval: input.approval,
          signature: input.signature,
          recordedAt: new Date().toISOString(),
        };
        const receipt = await createApprovalEvidence({
          database,
          action: currentDecision.action,
          approval,
          privateKeyPem: originPrivateKey,
        });
        const origin = database.origins.find(
          (entry) => entry.id === "approval-agent-deploy",
        )!;
        receipt.verified = verifyEvidenceReceipt(
          receipt,
          origin.publicKeyPem,
        );
        database.approvals.push(approval);
        database.evidence.push(receipt);
        database.audit.push(
          auditEvent(
            "HUMAN_APPROVAL_VERIFIED",
            "Uma aprovação humana independente foi verificada.",
            {
              approvalId: approval.id,
              decisionId: input.approval.decisionId,
              requestId: input.approval.requestId,
              approverId: input.approval.approverId,
              evidenceId: receipt.id,
            },
          ),
        );
        return { approval, receipt, reused: false };
      });
      return reply.code(result.reused ? 200 : 201).send(result);
    } catch (error) {
      if (error instanceof ApprovalRouteError) {
        return sendApiError(
          request,
          reply,
          error.statusCode,
          error.code,
          error.message,
        );
      }
      if (isZodError(error)) {
        return sendApiError(
          request,
          reply,
          400,
          "INVALID_REQUEST",
          "The approval request is invalid",
        );
      }
      throw error;
    }
  });

  app.post("/api/simulation/run", async (request, reply) => {
    if (limitedPublicApi) return workerUnavailable(request, reply);
    try {
      const action = ProposedActionSchema.parse(request.body);
      const originKeys = new Map<string, string>();
      const selectedOrigins = (await store.read()).origins.filter(
        (origin) =>
          origin.scenarioId === action.scenarioId &&
          origin.sourceClass !== "signed_approval",
      );
      for (const origin of selectedOrigins) {
        originKeys.set(origin.id, await store.originPrivateKey(origin.id));
      }
      await store.update(async (database) => {
        ensureSelectedAction(database, action);
        database.defaultAction = action;
        const actionCommitment = sha256Hex(action);
        const origins = database.origins.filter(
          (origin) =>
            origin.scenarioId === action.scenarioId &&
            origin.sourceClass !== "signed_approval",
        );
        for (const origin of origins) {
          const reusable = database.evidence.some(
            (receipt) =>
              receipt.requestId === action.requestId &&
              receipt.sourceId === origin.id &&
              receipt.actionCommitment === actionCommitment &&
              receipt.verified &&
              new Date(receipt.expiresAt).getTime() > Date.now(),
          );
          if (reusable) continue;
          const receipt = await createSignedEvidence({
            database,
            sourceId: origin.id,
            action,
            variant: "valid",
            privateKeyPem: originKeys.get(origin.id)!,
          });
          receipt.verified = verifyEvidenceReceipt(receipt, origin.publicKeyPem);
          database.evidence.push(receipt);
          database.audit.push(
            auditEvent("ORIGIN_EVIDENCE_COLLECTED", `${origin.name} emitiu uma evidência válida.`, {
              evidenceId: receipt.id,
              automatic: true,
            }),
          );
        }
      });
      const decision = await evaluateAndPersist(action, request);
      const expired = await store.update((database) =>
        expireRequestEvidence(database, action.requestId),
      );
      return { decision, execution: null, expired };
    } catch (error) {
      if (error instanceof MidnightAnchorError) {
        return sendAnchorError(request, reply, error);
      }
      throw error;
    }
  });

  app.post("/api/execute", async (request, reply) => {
    if (limitedPublicApi) return workerUnavailable(request, reply);
    try {
      const { permitId } = ExecutePermitRequestSchema.parse(request.body);
      const idempotencyKey = IdempotencyKeySchema.parse(
        firstHeader(request.headers["idempotency-key"]),
      );
      const network = await getNetworkStatus();
      const reservation = await store.update((database) => {
        const priorKey = database.executions.find(
          (entry) => entry.idempotencyKey === idempotencyKey,
        );
        if (priorKey) {
          if (priorKey.permitId !== permitId) {
            throw new ExecutionRouteError(
              409,
              "IDEMPOTENCY_CONFLICT",
              "The idempotency key is already bound to another permit",
            );
          }
          return { execution: priorKey, dispatch: null, reused: true };
        }
        const dispatch = executionDispatch(
          database,
          permitId,
          stagingExecutor,
          network,
        );
        const consumed = database.executions.find(
          (entry) =>
            entry.permitId === permitId ||
            entry.requestId === dispatch.requestId,
        );
        if (consumed) {
          throw new ExecutionRouteError(
            409,
            consumed.status === "pending" || consumed.status === "executing"
              ? "EXECUTION_IN_PROGRESS"
              : "PERMIT_ALREADY_CONSUMED",
            "The permit or action nonce has already been consumed",
          );
        }
        const now = new Date().toISOString();
        const execution = ControlledExecutionSchema.parse({
          id: randomUUID(),
          permitId,
          requestId: dispatch.requestId,
          actionCommitment: sha256Hex(
            database.decisions.find((entry) => entry.permit?.id === permitId)!
              .permit!.action,
          ),
          idempotencyKey,
          status: "pending",
          createdAt: now,
          updatedAt: now,
          startedAt: null,
          finishedAt: null,
          externalReference: null,
          failureCode: null,
        });
        database.executions.push(execution);
        database.audit.push(
          auditEvent(
            "EXECUTION_RESERVED",
            "O permit foi reservado de forma idempotente antes do efeito externo.",
            {
              executionId: execution.id,
              permitId,
              requestId: dispatch.requestId,
            },
          ),
        );
        return { execution, dispatch, reused: false };
      });

      if (reservation.reused || !reservation.dispatch) {
        return reply.code(200).send(reservation.execution);
      }

      const started = await store.update((database) => {
        const execution = database.executions.find(
          (entry) => entry.id === reservation.execution.id,
        )!;
        execution.status = "executing";
        execution.startedAt = new Date().toISOString();
        execution.updatedAt = execution.startedAt;
        return ControlledExecutionSchema.parse(execution);
      });

      try {
        const dispatched = await stagingExecutor.dispatch(reservation.dispatch);
        const succeeded = await store.update((database) => {
          const execution = database.executions.find(
            (entry) => entry.id === started.id,
          )!;
          execution.status = "succeeded";
          execution.finishedAt = new Date().toISOString();
          execution.updatedAt = execution.finishedAt;
          execution.externalReference = dispatched.externalReference.slice(
            0,
            200,
          );
          database.audit.push(
            auditEvent(
              "ACTION_EXECUTED",
              "O workflow fechado de staging foi disparado.",
              {
                executionId: execution.id,
                permitId,
                requestId: execution.requestId,
                externalReference: execution.externalReference,
              },
            ),
          );
          return ControlledExecutionSchema.parse(execution);
        });
        return reply.code(201).send(succeeded);
      } catch (error) {
        await store.update((database) => {
          const execution = database.executions.find(
            (entry) => entry.id === started.id,
          )!;
          execution.status = "failed";
          execution.finishedAt = new Date().toISOString();
          execution.updatedAt = execution.finishedAt;
          execution.failureCode = "EXECUTION_FAILED";
          database.audit.push(
            auditEvent(
              "EXECUTION_FAILED",
              "O efeito externo falhou depois da reserva do permit.",
              {
                executionId: execution.id,
                permitId,
                requestId: execution.requestId,
              },
            ),
          );
          return ControlledExecutionSchema.parse(execution);
        });
        return sendApiError(
          request,
          reply,
          502,
          "EXECUTION_FAILED",
          "The staging workflow dispatch failed",
        );
      }
    } catch (error) {
      if (error instanceof ExecutionRouteError) {
        return sendApiError(
          request,
          reply,
          error.statusCode,
          error.code,
          error.message,
        );
      }
      if (isZodError(error)) {
        return sendApiError(
          request,
          reply,
          400,
          "INVALID_REQUEST",
          "A UUID Idempotency-Key header and strict permit request are required",
        );
      }
      throw error;
    }
  });

  app.post("/api/lifecycle/expire", async () =>
    store.update((database) => ({
      expired: expireRequestEvidence(database, database.defaultAction.requestId),
    })),
  );

  app.get("/api/raw/:id", async (request, reply: FastifyReply) => {
    if (process.env.ALLOW_RAW_EVIDENCE_READ !== "true") {
      return reply.code(403).send({
        error: "Raw evidence access is disabled. Set ALLOW_RAW_EVIDENCE_READ=true only for local debugging.",
      });
    }
    const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
    const database = await store.read();
    const secret = database.evidenceSecrets[id];
    if (!secret) return reply.code(404).send({ error: "Evidence not found" });
    if (!secret.encryptionKeyBase64) {
      return reply.code(410).send({ error: "The encryption key was deleted." });
    }
    const envelope = JSON.parse(await readFile(secret.encryptedPath, "utf8"));
    return decryptJson(envelope, secret.encryptionKeyBase64);
  });
}
