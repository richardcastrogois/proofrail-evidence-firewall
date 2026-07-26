import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  NetworkIdSchema,
  ProposedActionSchema,
  ScenarioIdSchema,
  type ProposedAction,
  type PublicState,
} from "@rational/shared";

const apiUrl =
  process.env.PROOFRAIL_API_URL ??
  process.env.RATIONAL_API_URL ??
  "http://127.0.0.1:3333";
const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const authSecretsPath =
  process.env.PROOFRAIL_SERVICE_AUTH_SECRETS ??
  path.resolve(
    moduleDir,
    "../../../data/private/service-auth-secrets.json",
  );
const AuthSecretsSchema = z
  .object({
    schemaVersion: z.literal(1),
    tokens: z.record(z.string().min(32)),
  })
  .passthrough();
const serviceTokens = AuthSecretsSchema.parse(
  JSON.parse(await readFile(authSecretsPath, "utf8")),
).tokens;

async function api<T>(
  route: string,
  body?: unknown,
  additionalHeaders: Record<string, string> = {},
  principalId = "orchestrator-local",
): Promise<T> {
  const token = serviceTokens[principalId];
  if (!token) {
    throw new Error(
      `Local service token is unavailable for ${principalId}`,
    );
  }
  const response = await fetch(`${apiUrl}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
      ...additionalHeaders,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as {
    error?: string | { message?: string };
  } & T;
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "object"
        ? (payload.error.message ?? `HTTP ${response.status}`)
        : (payload.error ?? `HTTP ${response.status}`),
    );
  }
  return payload;
}

function toolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

const server = new McpServer(
  { name: "proofrail", version: "0.2.0" },
  {
    instructions:
      "Proofrail is an evidence firewall. Its primary pilot binds an AI agent deployment request to an exact task, repository, commit, artifact, service and environment. GitHub CI uses a read-only GitHub App; the separate executor can dispatch only the configured staging workflow. Policy evaluation, signatures, approvals, idempotent one-time permits and Midnight anchoring are enforced. Never treat a self-declaration as trusted origin evidence and never hide contradictions.",
  },
);

server.tool(
  "get_proofrail_state",
  "Read scenarios, selected network, evidence, decisions, anchors, executions and data-lifecycle metrics.",
  {},
  async () => toolResult(await api("/api/state")),
);

server.tool(
  "select_proofrail_scenario",
  "Select one of the nine security scenarios. agent_deploy is the primary pilot; the other scenarios remain policy templates.",
  { scenarioId: ScenarioIdSchema },
  async ({ scenarioId }) =>
    toolResult(
      await api(
        "/api/scenario/select",
        { scenarioId },
        {},
        "operator-local",
      ),
    ),
);

server.tool(
  "select_midnight_network",
  "Switch the active Midnight target. A public network must already have a funded wallet and deployed contract.",
  { network: NetworkIdSchema },
  async ({ network }) =>
    toolResult(
      await api(
        "/api/network/select",
        { network },
        {},
        "operator-local",
      ),
    ),
);

server.tool(
  "verify_github_ci_evidence",
  "Verify a signed agent_deploy action against the configured GitHub App, a matching workflow_run webhook, the exact commit SHA and the exact non-expired artifact digest. The agent signature must cover the canonical Proofrail action payload.",
  {
    action: ProposedActionSchema,
    agentSignature: z.string().min(40),
    deliveryId: z.string().uuid().optional(),
  },
  async ({ action, agentSignature, deliveryId }) =>
    toolResult(
      await api(
        "/api/integrations/github/verify-ci",
        { action, deliveryId },
        { "X-Proofrail-Agent-Signature": agentSignature },
      ),
    ),
);

server.tool(
  "run_proofrail_simulation",
  "Run the laboratory simulation: generate simulated origin receipts, evaluate the real deterministic policy, anchor, consume a simulated-action ALLOW permit when possible and erase raw-evidence keys. This tool does not call GitHub or deploy a real service.",
  {
    scenarioId: ScenarioIdSchema,
    subjectId: z.string().min(1).max(120).optional(),
    referenceId: z.string().min(1).max(120).optional(),
    value: z.number().nonnegative().optional(),
  },
  async ({ scenarioId, subjectId, referenceId, value }) => {
    await api(
      "/api/scenario/select",
      { scenarioId },
      {},
      "operator-local",
    );
    const state = await api<PublicState>(
      "/api/state",
      undefined,
      {},
      "operator-local",
    );
    const action: ProposedAction = ProposedActionSchema.parse({
      ...state.defaultAction,
      requestId: randomUUID(),
      subjectId: subjectId ?? state.defaultAction.subjectId,
      referenceId: referenceId ?? state.defaultAction.referenceId,
      value: value ?? state.defaultAction.value,
    });
    return toolResult(
      await api(
        "/api/simulation/run",
        action,
        {},
        "operator-local",
      ),
    );
  },
);

server.tool(
  "execute_action_permit",
  "Consume one fresh ALLOW permit. Reuse, expiry, missing anchor or altered commitments are rejected.",
  {
    permitId: z.string().uuid(),
    idempotencyKey: z.string().uuid().optional(),
  },
  async ({ permitId, idempotencyKey }) =>
    toolResult(
      await api(
        "/api/execute",
        { permitId },
        { "Idempotency-Key": idempotencyKey ?? randomUUID() },
        "executor-local",
      ),
    ),
);

server.tool(
  "expire_raw_evidence",
  "Delete evidence encryption keys while preserving signed receipts, commitments and anchors for audit.",
  {},
  async () =>
    toolResult(
      await api(
        "/api/lifecycle/expire",
        {},
        {},
        "operator-local",
      ),
    ),
);

server.tool(
  "reset_proofrail_lab",
  "Reset the lab while optionally keeping a selected scenario.",
  { scenarioId: ScenarioIdSchema.optional() },
  async ({ scenarioId }) =>
    toolResult(
      await api(
        "/api/reset",
        { scenarioId },
        {},
        "operator-local",
      ),
    ),
);

const transport = new StdioServerTransport();
await server.connect(transport);
