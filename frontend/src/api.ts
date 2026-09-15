import type {
  DecisionResult,
  EvidenceReceipt,
  NetworkId,
  NetworkStatus,
  ProposedAction,
  PublicState,
  ScenarioId,
} from "@rational/shared";

export interface DeclaredDocument {
  name: string;
  size: number;
  mimeType: string;
  sha256: string;
}

function normalizeApiBaseUrl(raw: string) {
  const value = raw.trim().replace(/\/+$/, "");
  if (value.endsWith("/api/health")) {
    return value.slice(0, -"/api/health".length);
  }
  if (value.endsWith("/api")) {
    return value.slice(0, -"/api".length);
  }
  return value;
}

const baseUrl = normalizeApiBaseUrl(import.meta.env.VITE_API_URL ?? "");
export const apiConfigured = baseUrl.length > 0;
export const apiLimited = import.meta.env.VITE_PROOFRAIL_API_MODE === "limited";
const STARTUP_RETRY_ATTEMPTS = 30;
const STARTUP_RETRY_DELAY_MS = 1_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
// Keep the browser window slightly above the API's 10-minute CLI ceiling.
const MIDNIGHT_REQUEST_TIMEOUT_MS = 630_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requestTimeoutMessage(path: string) {
  if (path === "/api/simulation/run" || path === "/api/evaluate") {
    return "A rede Midnight não respondeu dentro do limite. A transação pode ter sido submetida; confira os logs [API] e o recibo público antes de repetir.";
  }
  return "A API demorou para responder. Confira se o servidor ainda está rodando no PowerShell.";
}

async function request<T>(
  path: string,
  options?: RequestInit,
  requestOptions: {
    timeoutMs?: number;
    startupRetries?: number;
  } = {},
): Promise<T> {
  if (!apiConfigured) {
    throw new Error(
      "API pública ainda não conectada. Este deploy mostra o frontend em modo seguro, sem executar decisões, banco ou Midnight.",
    );
  }

  const hasBody = options?.body !== undefined;
  const startupRetries = requestOptions.startupRetries ?? 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= startupRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      requestOptions.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          ...(hasBody ? { "Content-Type": "application/json" } : {}),
          ...options?.headers,
        },
        signal: controller.signal,
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;

      if (!response.ok) {
        const apiMessage =
          typeof payload?.error === "object"
            ? payload.error?.message
            : payload?.error;
        throw new Error(
          apiMessage === "Internal Server Error"
            ? "Falha interna ao processar a decisão. Consulte os logs [API] no PowerShell."
            : (apiMessage ?? `HTTP ${response.status}`),
        );
      }

      if (payload === null) {
        throw new Error("A API retornou uma resposta vazia.");
      }
      return payload as T;
    } catch (error) {
      lastError = error;
      const canRetry =
        attempt < startupRetries &&
        error instanceof TypeError &&
        path === "/api/state";
      if (!canRetry) {
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new Error(requestTimeoutMessage(path));
        }
        if (error instanceof SyntaxError) {
          throw new Error(
            "A API retornou uma resposta incompleta. Aguarde a inicialização terminar e recarregue a página.",
          );
        }
        throw error;
      }
      await sleep(STARTUP_RETRY_DELAY_MS);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export const api = {
  state: () =>
    request<PublicState>("/api/state", undefined, {
      startupRetries: STARTUP_RETRY_ATTEMPTS,
    }),

  reset: (scenarioId?: ScenarioId) =>
    request<PublicState>("/api/reset", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    }),

  selectScenario: (scenarioId: ScenarioId) =>
    request<PublicState>("/api/scenario/select", {
      method: "POST",
      body: JSON.stringify({ scenarioId }),
    }),

  selectNetwork: (network: NetworkId) =>
    request<NetworkStatus>("/api/network/select", {
      method: "POST",
      body: JSON.stringify({ network }),
    }),

  selfDeclared: (action: ProposedAction) =>
    request<EvidenceReceipt>("/api/evidence/self-declared", {
      method: "POST",
      body: JSON.stringify(action),
    }),

  document: (action: ProposedAction, document: DeclaredDocument) =>
    request<EvidenceReceipt>("/api/evidence/document", {
      method: "POST",
      body: JSON.stringify({ action, document }),
    }),

  collect: (
    sourceId: string,
    action: ProposedAction,
    variant: "valid" | "contradictory",
  ) =>
    request<EvidenceReceipt>("/api/evidence/collect", {
      method: "POST",
      body: JSON.stringify({ sourceId, action, variant }),
    }),

  evaluate: (action: ProposedAction) =>
    request<DecisionResult>("/api/evaluate", {
      method: "POST",
      body: JSON.stringify(action),
    }, {
      timeoutMs: MIDNIGHT_REQUEST_TIMEOUT_MS,
    }),

  runSimulation: (action: ProposedAction) =>
    request<{
      decision: DecisionResult;
      execution: unknown | null;
      expired: number;
    }>("/api/simulation/run", {
      method: "POST",
      body: JSON.stringify(action),
    }, {
      timeoutMs: MIDNIGHT_REQUEST_TIMEOUT_MS,
    }),

  execute: (permitId: string, idempotencyKey = crypto.randomUUID()) =>
    request("/api/execute", {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: JSON.stringify({ permitId }),
    }),

  expire: () =>
    request<{ expired: number }>("/api/lifecycle/expire", {
      method: "POST",
    }),
};
