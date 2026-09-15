import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
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
    "../../data/private/service-auth-secrets.json",
  );
const transportMode = process.env.PROOFRAIL_WORKER_TRANSPORT ?? "stdio";
const port = Number(process.env.PORT ?? 3334);
const host = process.env.HOST ?? "0.0.0.0";
const allowedBrowserOrigins = new Set(
  (process.env.PROOFRAIL_PUBLIC_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const AuthSecretsSchema = z
  .object({
    schemaVersion: z.literal(1),
    tokens: z.record(z.string().min(32)),
  })
  .passthrough();
let serviceTokensPromise: Promise<Record<string, string>> | undefined;

async function loadServiceTokens() {
  serviceTokensPromise ??= (async () => {
    const inlineSecrets = process.env.PROOFRAIL_SERVICE_AUTH_SECRETS_JSON?.trim();
    const raw = inlineSecrets || (await readFile(authSecretsPath, "utf8"));
    return AuthSecretsSchema.parse(JSON.parse(raw)).tokens;
  })();
  return serviceTokensPromise;
}

async function api<T>(
  route: string,
  body?: unknown,
  additionalHeaders: Record<string, string> = {},
  principalId = "orchestrator-local",
): Promise<T> {
  const serviceTokens = await loadServiceTokens();
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

function sendJson(
  request: IncomingMessage,
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
) {
  response.writeHead(statusCode, responseHeaders(request, {
    "cache-control": "no-store",
    "content-type": "application/json",
  }));
  response.end(JSON.stringify(payload));
}

function responseHeaders(
  request: IncomingMessage,
  headers: Record<string, string> = {},
) {
  const origin = request.headers.origin;
  if (typeof origin === "string" && allowedBrowserOrigins.has(origin)) {
    return {
      ...headers,
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "content-type, idempotency-key, x-request-id",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      vary: "Origin",
    };
  }
  return headers;
}

async function readRequestBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function principalForRoute(method: string, pathname: string) {
  if (method === "GET" && pathname === "/api/state") return "orchestrator-local";
  if (method === "POST" && pathname === "/api/integrations/github/verify-ci") return "orchestrator-local";
  if (method === "POST" && pathname === "/api/evidence/self-declared") return "orchestrator-local";
  if (method === "POST" && pathname === "/api/evidence/document") return "orchestrator-local";
  if (method === "POST" && pathname === "/api/evidence/collect") return "orchestrator-local";
  if (method === "POST" && pathname === "/api/evaluate") return "orchestrator-local";
  if (method === "POST" && pathname === "/api/scenario/select") return "operator-local";
  if (method === "POST" && pathname === "/api/network/select") return "operator-local";
  if (method === "POST" && pathname === "/api/simulation/run") return "operator-local";
  if (method === "POST" && pathname === "/api/lifecycle/expire") return "operator-local";
  if (method === "POST" && pathname === "/api/reset") return "operator-local";
  if (method === "POST" && pathname === "/api/execute") return "executor-local";
  return undefined;
}

async function proxyApiRequest(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url ?? "/", "http://worker.local");
  const pathname = url.pathname;
  if (request.method === "GET" && pathname === "/api/health") {
    const backendResponse = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });
    const body = await backendResponse.text();
    response.writeHead(backendResponse.status, responseHeaders(request, {
      "cache-control": "no-store",
      "content-type": backendResponse.headers.get("content-type") ?? "application/json",
    }));
    response.end(body);
    return;
  }

  const principalId = principalForRoute(request.method ?? "GET", pathname);
  if (!principalId) {
    sendJson(request, response, 404, { error: "Unsupported worker API route" });
    return;
  }

  const serviceTokens = await loadServiceTokens();
  const token = serviceTokens[principalId];
  if (!token) {
    sendJson(request, response, 500, { error: `Worker token is unavailable for ${principalId}` });
    return;
  }

  const body = request.method === "GET" ? undefined : await readRequestBody(request);
  const backendResponse = await fetch(`${apiUrl}${pathname}${url.search}`, {
    method: request.method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": request.headers["content-type"] ?? "application/json" } : {}),
      ...(typeof request.headers["idempotency-key"] === "string"
        ? { "idempotency-key": request.headers["idempotency-key"] }
        : {}),
      ...(typeof request.headers["x-request-id"] === "string"
        ? { "x-request-id": request.headers["x-request-id"] }
        : {}),
    },
    body,
  });
  const responseBody = await backendResponse.text();
  response.writeHead(backendResponse.status, responseHeaders(request, {
    "cache-control": "no-store",
    "content-type": backendResponse.headers.get("content-type") ?? "application/json",
  }));
  response.end(responseBody);
}

function startHttpHealthServer() {
  const server = createServer(async (request, response) => {
    if (request.method === "OPTIONS") {
      response.writeHead(204, responseHeaders(request));
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", "http://worker.local");
    if (url.pathname.startsWith("/api/")) {
      try {
        await proxyApiRequest(request, response);
      } catch (error) {
        sendJson(request, response, 502, {
          ok: false,
          service: "proofrail-worker",
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.method !== "GET") {
      sendJson(request, response, 405, { error: "Method not allowed" });
      return;
    }

    if (request.url === "/api-state-check") {
      try {
        const state = await api<PublicState>("/api/state");
        sendJson(request, response, 200, {
          ok: true,
          service: "proofrail-worker",
          check: "api-state",
          apiUrl,
          selectedScenarioId: state.selectedScenarioId,
          mode: state.mode,
          evidenceCount: state.evidence.length,
          decisionCount: state.decisions.length,
        });
      } catch (error) {
        sendJson(request, response, 502, {
          ok: false,
          service: "proofrail-worker",
          check: "api-state",
          apiUrl,
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    if (request.url !== "/health" && request.url !== "/") {
      sendJson(request, response, 404, { error: "Not found" });
      return;
    }

    const secretsConfigured = Boolean(
      process.env.PROOFRAIL_SERVICE_AUTH_SECRETS_JSON?.trim() ||
        process.env.PROOFRAIL_SERVICE_AUTH_SECRETS,
    );
    sendJson(request, response, 200, {
      ok: true,
      service: "proofrail-worker",
      transport: "http",
      apiUrl,
      secretsConfigured,
    });
  });

  server.listen(port, host, () => {
    console.log(`Proofrail worker health server listening on http://${host}:${port}`);
  });
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

if (transportMode === "http") {
  startHttpHealthServer();
} else {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
