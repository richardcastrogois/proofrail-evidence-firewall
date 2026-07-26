import {
  createHash,
  createPublicKey,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import {
  ApiErrorResponseSchema,
  ServicePrincipalSchema,
  type ApiErrorCode,
  type ServicePrincipal,
  type ServiceScope,
} from "@rational/shared";
import { z } from "zod";
import {
  ROUTE_ACCESS_RULES,
  type RouteAccessRule,
} from "./access-control";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const TokenHashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const IdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const ServicePrincipalConfigSchema = z
  .object({
    id: IdentifierSchema,
    kind: z.enum(["orchestrator", "approver", "executor", "operator"]),
    scopes: z.array(z.string()).min(1).max(20),
    tokenSha256: TokenHashSchema,
  })
  .strict();

const ApproverKeyConfigSchema = z
  .object({
    id: IdentifierSchema,
    approverId: IdentifierSchema,
    publicKeyPem: z.string().min(40).max(2_000),
  })
  .strict()
  .superRefine((entry, context) => {
    try {
      if (createPublicKey(entry.publicKeyPem).asymmetricKeyType !== "ed25519") {
        throw new Error("not Ed25519");
      }
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publicKeyPem"],
        message: "Approver keys must be valid Ed25519 public keys",
      });
    }
  });

export const ServiceAuthFileSchema = z
  .object({
    schemaVersion: z.literal(1),
    principals: z.array(ServicePrincipalConfigSchema).min(1).max(50),
    approverKeys: z.array(ApproverKeyConfigSchema).max(50),
  })
  .strict()
  .superRefine((config, context) => {
    const principalIds = new Set<string>();
    const tokenHashes = new Set<string>();
    const approverKeyIds = new Set<string>();

    config.principals.forEach((principal, index) => {
      const parsed = ServicePrincipalSchema.safeParse({
        id: principal.id,
        kind: principal.kind,
        scopes: principal.scopes,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["principals", index, ...issue.path],
            message: issue.message,
          });
        }
      }
      if (principalIds.has(principal.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["principals", index, "id"],
          message: "Service principal IDs must be unique",
        });
      }
      if (tokenHashes.has(principal.tokenSha256)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["principals", index, "tokenSha256"],
          message: "A service token cannot be shared by multiple principals",
        });
      }
      principalIds.add(principal.id);
      tokenHashes.add(principal.tokenSha256);
    });

    config.approverKeys.forEach((key, index) => {
      if (approverKeyIds.has(key.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approverKeys", index, "id"],
          message: "Approver key IDs must be unique",
        });
      }
      approverKeyIds.add(key.id);
      const principal = config.principals.find(
        (candidate) => candidate.id === key.approverId,
      );
      if (!principal || principal.kind !== "approver") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approverKeys", index, "approverId"],
          message: "Approver keys must belong to an approver principal",
        });
      }
    });

    for (const principal of config.principals) {
      if (
        principal.kind === "approver" &&
        !config.approverKeys.some(
          (key) => key.approverId === principal.id,
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approverKeys"],
          message: `Approver principal ${principal.id} has no trusted key`,
        });
      }
    }
  });

export type ServiceAuthFile = z.infer<typeof ServiceAuthFileSchema>;
export type ApproverKeyConfig = z.infer<typeof ApproverKeyConfigSchema>;

export class ServiceAuthConfigurationError extends Error {}

declare module "fastify" {
  interface FastifyRequest {
    servicePrincipal?: ServicePrincipal;
    correlationRequestId?: string;
  }
}

export function hashServiceToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function firstHeader(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function correlationRequestId(request: FastifyRequest): string {
  if (request.correlationRequestId) return request.correlationRequestId;
  const candidate = firstHeader(request.headers["x-request-id"]);
  const parsed = z.string().uuid().safeParse(candidate);
  request.correlationRequestId = parsed.success
    ? parsed.data
    : randomUUID();
  return request.correlationRequestId;
}

export function sendApiError(
  request: FastifyRequest,
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
) {
  const requestId = correlationRequestId(request);
  reply.header("x-request-id", requestId);
  return reply.code(statusCode).send(
    ApiErrorResponseSchema.parse({
      error: { code, message, requestId },
    }),
  );
}

function routeRule(request: FastifyRequest): RouteAccessRule | undefined {
  return ROUTE_ACCESS_RULES.find(
    (rule) =>
      rule.method === request.method &&
      rule.path === request.routeOptions.url,
  );
}

export class ServiceAuthenticator {
  readonly principals: Array<ServicePrincipal & { tokenSha256: string }>;
  readonly approverKeys: ApproverKeyConfig[];

  constructor(config: ServiceAuthFile) {
    const parsed = ServiceAuthFileSchema.parse(config);
    this.principals = parsed.principals.map((principal) => ({
      ...ServicePrincipalSchema.parse({
        id: principal.id,
        kind: principal.kind,
        scopes: principal.scopes,
      }),
      tokenSha256: principal.tokenSha256,
    }));
    this.approverKeys = parsed.approverKeys;
  }

  approverKey(
    keyId: string,
    approverId: string,
  ): ApproverKeyConfig | undefined {
    return this.approverKeys.find(
      (entry) =>
        entry.id === keyId && entry.approverId === approverId,
    );
  }

  private principalForToken(
    authorization: string | undefined,
  ): ServicePrincipal | undefined {
    const match = /^Bearer ([\x21-\x7e]{32,256})$/.exec(
      authorization ?? "",
    );
    const suppliedHash = Buffer.from(
      hashServiceToken(match?.[1] ?? ""),
      "hex",
    );
    let matched: ServicePrincipal | undefined;
    for (const principal of this.principals) {
      const expectedHash = Buffer.from(principal.tokenSha256, "hex");
      if (timingSafeEqual(suppliedHash, expectedHash)) {
        matched = {
          id: principal.id,
          kind: principal.kind,
          scopes: [...principal.scopes],
        };
      }
    }
    return match ? matched : undefined;
  }

  async authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    const rule = routeRule(request);
    if (!rule) {
      await sendApiError(
        request,
        reply,
        403,
        "INSUFFICIENT_SCOPE",
        "The route has no declared access rule",
      );
      return;
    }
    if (
      rule.authentication === "public" ||
      rule.authentication === "github_webhook"
    ) {
      return;
    }

    const authorization = firstHeader(request.headers.authorization);
    if (!authorization) {
      reply.header("www-authenticate", 'Bearer realm="proofrail"');
      await sendApiError(
        request,
        reply,
        401,
        "AUTHENTICATION_REQUIRED",
        "A service bearer token is required",
      );
      return;
    }
    const principal = this.principalForToken(authorization);
    if (!principal) {
      reply.header("www-authenticate", 'Bearer realm="proofrail"');
      await sendApiError(
        request,
        reply,
        401,
        "INVALID_CREDENTIALS",
        "The service bearer token is invalid",
      );
      return;
    }
    if (
      !rule.scope ||
      !principal.scopes.includes(rule.scope as ServiceScope)
    ) {
      await sendApiError(
        request,
        reply,
        403,
        "INSUFFICIENT_SCOPE",
        `The caller does not have ${rule.scope ?? "a declared scope"}`,
      );
      return;
    }
    request.servicePrincipal = principal;
    reply.header("x-request-id", correlationRequestId(request));
  }
}

export async function loadServiceAuthenticator(input: {
  env?: NodeJS.ProcessEnv;
  configPath?: string;
} = {}): Promise<ServiceAuthenticator> {
  const env = input.env ?? process.env;
  const dataDir =
    env.DATA_DIR ?? path.resolve(moduleDir, "../../../data");
  const configPath =
    input.configPath ??
    env.PROOFRAIL_SERVICE_AUTH_CONFIG ??
    path.join(dataDir, "private", "service-auth.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new ServiceAuthConfigurationError(
      `Service authentication config is unavailable at ${configPath}`,
      { cause: error },
    );
  }
  const result = ServiceAuthFileSchema.safeParse(parsed);
  if (!result.success) {
    throw new ServiceAuthConfigurationError(
      `Service authentication config is invalid: ${result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  return new ServiceAuthenticator(result.data);
}

export function registerServiceAuthentication(
  app: FastifyInstance,
  authenticator: ServiceAuthenticator,
): void {
  app.addHook("preHandler", (request, reply) =>
    authenticator.authenticate(request, reply),
  );
}
