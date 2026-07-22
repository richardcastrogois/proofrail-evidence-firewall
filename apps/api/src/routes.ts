import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  ActionPermitSchema,
  NetworkIdSchema,
  ProposedActionSchema,
  SCENARIOS,
  ScenarioIdSchema,
  scenarioById,
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
import { JsonStore, actionForScenario, auditEvent } from "./store";
import {
  createGitHubCiEvidence,
  createSelfDeclaredEvidence,
  createSignedEvidence,
} from "./origins";
import {
  GitHubAppClient,
  GitHubConfigurationError,
  GitHubDeliveryCollisionError,
  GitHubVerificationError,
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
  switchMidnightNetwork,
} from "./midnight-adapter";
import type { Database } from "./types";

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

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

function executePermit(
  database: Database,
  permitId: string,
): { id: string; permitId: string; action: ProposedAction; executedAt: string } {
  const decision = database.decisions.find(
    (entry) => entry.permit?.id === permitId,
  );
  if (!decision?.permit || decision.status !== "ALLOW") {
    throw new Error("Permit not found or decision is not ALLOW");
  }
  const permit = ActionPermitSchema.parse(decision.permit);
  if (
    permit.actionCommitment !== sha256Hex(permit.action) ||
    permit.actionCommitment !== decision.actionCommitment ||
    permit.evidenceRoot !== decision.evidenceRoot ||
    permit.policyCommitment !== decision.policyCommitment
  ) {
    throw new Error("Permit is not bound to the evaluated action and evidence");
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
    anchor.decision !== "ALLOW" ||
    anchor.validUntil !== permit.expiresAt
  ) {
    throw new Error("Permit is not bound to the persisted ALLOW anchor");
  }
  if (
    permit.publicKeyPem !== database.fabricIdentity.publicKeyPem ||
    !verifyCanonical(
      permitPayload(permit),
      permit.signature,
      database.fabricIdentity.publicKeyPem,
    )
  ) {
    throw new Error("Invalid permit signature");
  }
  if (new Date(permit.expiresAt).getTime() < Date.now()) {
    throw new Error("Permit expired");
  }
  if (database.executions.some((entry) => entry.permitId === permit.id)) {
    throw new Error("Permit already consumed");
  }

  const execution = {
    id: randomUUID(),
    permitId: permit.id,
    action: permit.action,
    executedAt: new Date().toISOString(),
  };
  database.executions.push(execution);
  const scenario = scenarioById(permit.action.scenarioId);
  database.audit.push(
    auditEvent(
      "ACTION_EXECUTED",
      `${scenario.shortTitle}: ação simulada executada para ${permit.action.referenceId}.`,
      { executionId: execution.id, permitId: permit.id },
    ),
  );
  return execution;
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
  store: JsonStore,
): Promise<void> {
  async function evaluateAndPersist(action: ProposedAction) {
    const database = await store.read();
    ensureSelectedAction(database, action);
    verifyAllEvidence(database);
    const decision = evaluateEvidencePolicy({
      action,
      policy: database.policy,
      evidence: database.evidence,
    });
    const anchor = await createAnchorAdapter().anchor(decision);
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

  app.get("/api/health", async () => ({
    ok: true,
    service: "proofrail-api",
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

  app.post("/api/network/select", async (request) => {
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

  app.post("/api/evidence/collect", async (request) => {
    const input = CollectEvidenceSchema.parse(request.body);
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

  app.post("/api/evaluate", async (request) =>
    evaluateAndPersist(ProposedActionSchema.parse(request.body)),
  );

  app.post("/api/simulation/run", async (request) => {
    const action = ProposedActionSchema.parse(request.body);
    const originKeys = new Map<string, string>();
    const selectedOrigins = (await store.read()).origins.filter(
      (origin) => origin.scenarioId === action.scenarioId,
    );
    for (const origin of selectedOrigins) {
      originKeys.set(origin.id, await store.originPrivateKey(origin.id));
    }
    await store.update(async (database) => {
      ensureSelectedAction(database, action);
      database.defaultAction = action;
      const origins = database.origins.filter((origin) => origin.scenarioId === action.scenarioId);
      for (const origin of origins) {
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
    const decision = await evaluateAndPersist(action);
    let execution = null;
    let expired = 0;
    if (decision.permit) {
      execution = await store.update((database) => executePermit(database, decision.permit!.id));
    }
    expired = await store.update((database) => expireRequestEvidence(database, action.requestId));
    return { decision, execution, expired };
  });

  app.post("/api/execute", async (request, reply) => {
    const { permitId } = z.object({ permitId: z.string().uuid() }).parse(request.body);
    try {
      return await store.update((database) => executePermit(database, permitId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message.includes("already consumed") ? 409 : 403;
      return reply.code(status).send({ error: message });
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
