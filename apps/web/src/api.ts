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

const baseUrl = import.meta.env.VITE_API_URL ?? "";

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const hasBody = options?.body !== undefined;
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const apiMessage =
      typeof payload.error === "object"
        ? payload.error?.message
        : payload.error;
    throw new Error(
      apiMessage === "Internal Server Error"
        ? "Falha interna ao processar a decisão. Consulte os logs [API] no PowerShell."
        : (apiMessage ?? `HTTP ${response.status}`),
    );
  }

  return payload as T;
}

export const api = {
  state: () => request<PublicState>("/api/state"),

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
    }),

  runSimulation: (action: ProposedAction) =>
    request<{
      decision: DecisionResult;
      execution: unknown | null;
      expired: number;
    }>("/api/simulation/run", {
      method: "POST",
      body: JSON.stringify(action),
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
