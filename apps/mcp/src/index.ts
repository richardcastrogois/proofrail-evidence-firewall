import { randomUUID } from "node:crypto";
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

async function api<T>(
  route: string,
  body?: unknown,
  additionalHeaders: Record<string, string> = {},
): Promise<T> {
  const response = await fetch(`${apiUrl}${route}`, {
    method: body === undefined ? "GET" : "POST",
    headers:
      body === undefined
        ? undefined
        : { "Content-Type": "application/json", ...additionalHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json()) as { error?: string } & T;
  if (!response.ok) {
    throw new Error(payload.error ?? `HTTP ${response.status}`);
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
      "Proofrail is an evidence firewall. Its primary pilot binds an AI agent deployment request to an exact task, repository, commit, artifact, service and environment. GitHub CI can be verified through a least-privilege GitHub App; the remaining source buttons and final executor are still laboratory simulations. Policy evaluation, signatures, one-time permits and Midnight anchoring are real. Never treat a self-declaration as trusted origin evidence and never hide contradictions.",
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
    toolResult(await api("/api/scenario/select", { scenarioId })),
);

server.tool(
  "select_midnight_network",
  "Switch the active Midnight target. A public network must already have a funded wallet and deployed contract.",
  { network: NetworkIdSchema },
  async ({ network }) =>
    toolResult(await api("/api/network/select", { network })),
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
    await api("/api/scenario/select", { scenarioId });
    const state = await api<PublicState>("/api/state");
    const action: ProposedAction = ProposedActionSchema.parse({
      ...state.defaultAction,
      requestId: randomUUID(),
      subjectId: subjectId ?? state.defaultAction.subjectId,
      referenceId: referenceId ?? state.defaultAction.referenceId,
      value: value ?? state.defaultAction.value,
    });
    return toolResult(await api("/api/simulation/run", action));
  },
);

server.tool(
  "execute_action_permit",
  "Consume one fresh ALLOW permit. Reuse, expiry, missing anchor or altered commitments are rejected.",
  { permitId: z.string().uuid() },
  async ({ permitId }) =>
    toolResult(await api("/api/execute", { permitId })),
);

server.tool(
  "expire_raw_evidence",
  "Delete evidence encryption keys while preserving signed receipts, commitments and anchors for audit.",
  {},
  async () => toolResult(await api("/api/lifecycle/expire", {})),
);

server.tool(
  "reset_proofrail_lab",
  "Reset the lab while optionally keeping a selected scenario.",
  { scenarioId: ScenarioIdSchema.optional() },
  async ({ scenarioId }) =>
    toolResult(await api("/api/reset", { scenarioId })),
);

const transport = new StdioServerTransport();
await server.connect(transport);
