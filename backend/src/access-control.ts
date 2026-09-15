import type { ServiceScope } from "@rational/shared";

export type RouteAuthentication = "public" | "github_webhook" | "service";

export interface RouteAccessRule {
  method: "GET" | "POST";
  path: string;
  authentication: RouteAuthentication;
  scope?: ServiceScope;
}

export const ROUTE_ACCESS_RULES: readonly RouteAccessRule[] = [
  {
    method: "GET",
    path: "/api/health",
    authentication: "public",
  },
  {
    method: "POST",
    path: "/api/integrations/github/webhook",
    authentication: "github_webhook",
  },
  {
    method: "GET",
    path: "/api/state",
    authentication: "service",
    scope: "state:read",
  },
  {
    method: "POST",
    path: "/api/integrations/github/verify-ci",
    authentication: "service",
    scope: "github:verify-ci",
  },
  {
    method: "POST",
    path: "/api/reset",
    authentication: "service",
    scope: "system:reset",
  },
  {
    method: "POST",
    path: "/api/scenario/select",
    authentication: "service",
    scope: "scenario:select",
  },
  {
    method: "POST",
    path: "/api/network/select",
    authentication: "service",
    scope: "network:select",
  },
  {
    method: "POST",
    path: "/api/evidence/self-declared",
    authentication: "service",
    scope: "evidence:collect",
  },
  {
    method: "POST",
    path: "/api/evidence/document",
    authentication: "service",
    scope: "evidence:collect",
  },
  {
    method: "POST",
    path: "/api/evidence/collect",
    authentication: "service",
    scope: "evidence:collect",
  },
  {
    method: "POST",
    path: "/api/evaluate",
    authentication: "service",
    scope: "decision:evaluate",
  },
  {
    method: "POST",
    path: "/api/approvals",
    authentication: "service",
    scope: "approval:create",
  },
  {
    method: "POST",
    path: "/api/simulation/run",
    authentication: "service",
    scope: "simulation:run",
  },
  {
    method: "POST",
    path: "/api/execute",
    authentication: "service",
    scope: "permit:execute",
  },
  {
    method: "POST",
    path: "/api/lifecycle/expire",
    authentication: "service",
    scope: "evidence:expire",
  },
  {
    method: "GET",
    path: "/api/raw/:id",
    authentication: "service",
    scope: "evidence:raw:read",
  },
] as const;
