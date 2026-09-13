import {
  createHmac,
  createPrivateKey,
  createPublicKey,
  createSign,
  timingSafeEqual,
} from "node:crypto";
import { canonicalStringify, verifyCanonical } from "@rational/core";
import {
  ProposedActionSchema,
  type ProposedAction,
} from "@rational/shared";
import { z } from "zod";

const GITHUB_API_URL = "https://api.github.com";
const GITHUB_API_VERSION = "2026-03-10";
const MAX_GITHUB_RESPONSE_BYTES = 1_000_000;
const GITHUB_TIMEOUT_MS = 10_000;
const MAX_CLOCK_SKEW_MS = 5 * 60_000;

const AgentKeyRegistrySchema = z
  .record(z.array(z.string().min(40)).min(1).max(5))
  .refine((registry) => Object.keys(registry).length <= 100, {
    message: "At most 100 agent identities can be registered",
  });

const WorkflowRunSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(200),
  head_sha: z.string().regex(/^[0-9a-f]{40}$/),
  status: z.string(),
  conclusion: z.string().nullable(),
  html_url: z.string().url(),
  updated_at: z.string().datetime(),
});

const WorkflowRunsSchema = z.object({
  workflow_runs: z.array(WorkflowRunSchema).max(100),
});

const ArtifactSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).max(255),
  digest: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  expired: z.boolean(),
  updated_at: z.string().datetime(),
  workflow_run: z
    .object({
      id: z.number().int().positive(),
      head_sha: z.string().regex(/^[0-9a-f]{40}$/),
    })
    .nullable()
    .optional(),
});

const ArtifactsSchema = z.object({
  artifacts: z.array(ArtifactSchema).max(100),
});

const InstallationTokenSchema = z.object({
  token: z.string().min(20),
  expires_at: z.string().datetime(),
});

const WorkflowWebhookSchema = z.object({
  action: z.string().min(1).max(80),
  installation: z.object({ id: z.number().int().positive() }),
  repository: z.object({
    full_name: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  }),
  workflow_run: WorkflowRunSchema,
});

export interface GitHubIntegrationStatus {
  configured: boolean;
  webhookConfigured: boolean;
  agentIdentityConfigured: boolean;
  requireWebhook: boolean;
  allowedRepositories: string[];
  apiVersion: string;
  missingConfiguration: string[];
}

export interface GitHubRuntimeConfig {
  appId: string;
  installationId: number;
  privateKeyPem: string;
  webhookSecret: string;
  allowedRepositories: string[];
  requireWebhook: boolean;
  agentPublicKeys: Record<string, string[]>;
}

export interface GitHubWorkflowDelivery {
  deliveryId: string;
  event: "workflow_run";
  action: string;
  repository: string;
  commitSha: string;
  workflowRunId: number;
  workflowName: string;
  status: string;
  conclusion: string | null;
  installationId: number;
  receivedAt: string;
}

export interface GitHubCiVerification {
  repository: string;
  commitSha: string;
  artifactDigest: string;
  workflowRunId: number;
  workflowName: string;
  workflowUrl: string;
  artifactId: number;
  artifactName: string;
  observedAt: string;
}

export class GitHubConfigurationError extends Error {}
export class GitHubVerificationError extends Error {}
export class GitHubDeliveryCollisionError extends GitHubVerificationError {}

export function isGitHubObservationFresh(input: {
  observedAt: string;
  maxAgeMinutes: number;
  now?: number;
}): boolean {
  const observedAt = Date.parse(input.observedAt);
  const now = input.now ?? Date.now();
  const maxAgeMs = input.maxAgeMinutes * 60_000;
  return (
    Number.isFinite(observedAt) &&
    Number.isFinite(maxAgeMs) &&
    maxAgeMs > 0 &&
    observedAt <= now + MAX_CLOCK_SKEW_MS &&
    observedAt >= now - maxAgeMs
  );
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function parsePrivateKey(env: NodeJS.ProcessEnv): string | null {
  if (env.GITHUB_APP_PRIVATE_KEY_BASE64) {
    return Buffer.from(
      env.GITHUB_APP_PRIVATE_KEY_BASE64,
      "base64",
    ).toString("utf8").trim();
  }
  return env.GITHUB_APP_PRIVATE_KEY
    ? normalizePem(env.GITHUB_APP_PRIVATE_KEY)
    : null;
}

function isRsaPrivateKey(value: string | null): value is string {
  if (!value) return false;
  try {
    const key = createPrivateKey(value);
    return key.asymmetricKeyType === "rsa" || key.asymmetricKeyType === "rsa-pss";
  } catch {
    return false;
  }
}

function parseAllowedRepositories(value: string | undefined): string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map((entry) => entry.trim().toLowerCase())
        .filter((entry) =>
          /^[a-z0-9_.-]+\/[a-z0-9_.-]+$/.test(entry),
        ),
    ),
  ];
}

function parseAgentPublicKeys(
  value: string | undefined,
): Record<string, string[]> {
  if (!value) return {};
  try {
    const parsed = AgentKeyRegistrySchema.parse(JSON.parse(value));
    const registry = Object.fromEntries(
      Object.entries(parsed).map(([agentId, keys]) => [
        agentId,
        keys.map(normalizePem).filter((key) => {
          try {
            return createPublicKey(key).asymmetricKeyType === "ed25519";
          } catch {
            return false;
          }
        }),
      ]),
    );
    return Object.fromEntries(
      Object.entries(registry).filter(([, keys]) => keys.length > 0),
    );
  } catch {
    return {};
  }
}

export function getAgentPublicKeyRegistry(
  env: NodeJS.ProcessEnv = process.env,
): Record<string, string[]> {
  return parseAgentPublicKeys(
    env.PROOFRAIL_AGENT_PUBLIC_KEYS_JSON,
  );
}

export function getGitHubIntegrationStatus(
  env: NodeJS.ProcessEnv = process.env,
): GitHubIntegrationStatus {
  const missingConfiguration: string[] = [];
  const allowedRepositories = parseAllowedRepositories(
    env.GITHUB_ALLOWED_REPOSITORIES,
  );
  const installationId = Number(env.GITHUB_INSTALLATION_ID);
  const agentPublicKeys = getAgentPublicKeyRegistry(env);

  if (!env.GITHUB_APP_ID) missingConfiguration.push("GITHUB_APP_ID");
  if (!Number.isSafeInteger(installationId) || installationId <= 0) {
    missingConfiguration.push("GITHUB_INSTALLATION_ID");
  }
  if (!isRsaPrivateKey(parsePrivateKey(env))) {
    missingConfiguration.push("GITHUB_APP_PRIVATE_KEY_BASE64");
  }
  if (!env.GITHUB_WEBHOOK_SECRET) {
    missingConfiguration.push("GITHUB_WEBHOOK_SECRET");
  }
  if (allowedRepositories.length === 0) {
    missingConfiguration.push("GITHUB_ALLOWED_REPOSITORIES");
  }
  if (Object.keys(agentPublicKeys).length === 0) {
    missingConfiguration.push("PROOFRAIL_AGENT_PUBLIC_KEYS_JSON");
  }

  return {
    configured: missingConfiguration.length === 0,
    webhookConfigured: Boolean(env.GITHUB_WEBHOOK_SECRET),
    agentIdentityConfigured: Object.keys(agentPublicKeys).length > 0,
    requireWebhook: env.GITHUB_REQUIRE_WEBHOOK !== "false",
    allowedRepositories,
    apiVersion: GITHUB_API_VERSION,
    missingConfiguration,
  };
}

export function loadGitHubRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): GitHubRuntimeConfig {
  const status = getGitHubIntegrationStatus(env);
  if (!status.configured) {
    throw new GitHubConfigurationError(
      `GitHub App integration is not configured: ${status.missingConfiguration.join(", ")}`,
    );
  }

  return {
    appId: env.GITHUB_APP_ID!,
    installationId: Number(env.GITHUB_INSTALLATION_ID),
    privateKeyPem: parsePrivateKey(env)!,
    webhookSecret: env.GITHUB_WEBHOOK_SECRET!,
    allowedRepositories: status.allowedRepositories,
    requireWebhook: status.requireWebhook,
    agentPublicKeys: getAgentPublicKeyRegistry(env),
  };
}

export function verifyGitHubWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`;
  const actualBuffer = Buffer.from(signatureHeader, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function parseGitHubWorkflowDelivery(input: {
  rawBody: Buffer;
  event: string | undefined;
  deliveryId: string | undefined;
  receivedAt?: Date;
}): GitHubWorkflowDelivery {
  if (input.event !== "workflow_run") {
    throw new GitHubVerificationError(
      "Only workflow_run webhooks are accepted",
    );
  }
  const deliveryId = z.string().uuid().parse(input.deliveryId);
  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody.toString("utf8"));
  } catch {
    throw new GitHubVerificationError("Invalid GitHub webhook JSON");
  }
  const parsed = WorkflowWebhookSchema.parse(payload);
  return {
    deliveryId,
    event: "workflow_run",
    action: parsed.action,
    repository: parsed.repository.full_name.toLowerCase(),
    commitSha: parsed.workflow_run.head_sha,
    workflowRunId: parsed.workflow_run.id,
    workflowName: parsed.workflow_run.name,
    status: parsed.workflow_run.status,
    conclusion: parsed.workflow_run.conclusion,
    installationId: parsed.installation.id,
    receivedAt: (input.receivedAt ?? new Date()).toISOString(),
  };
}

export function isSameGitHubWorkflowDelivery(
  left: GitHubWorkflowDelivery,
  right: GitHubWorkflowDelivery,
): boolean {
  return (
    left.deliveryId === right.deliveryId &&
    left.event === right.event &&
    left.action === right.action &&
    left.repository === right.repository &&
    left.commitSha === right.commitSha &&
    left.workflowRunId === right.workflowRunId &&
    left.workflowName === right.workflowName &&
    left.status === right.status &&
    left.conclusion === right.conclusion &&
    left.installationId === right.installationId
  );
}

export function agentActionSigningPayload(action: ProposedAction) {
  return {
    purpose: "proofrail-agent-action-v1",
    action,
  };
}

export function verifyAgentActionSignature(input: {
  action: ProposedAction;
  signature: string | undefined;
  publicKeys: Record<string, string[]>;
}): boolean {
  try {
    const action = ProposedActionSchema.parse(input.action);
    const agentId = action.deployment?.agentId;
    if (!agentId || !input.signature) return false;
    return (input.publicKeys[agentId] ?? []).some((publicKeyPem) =>
      verifyCanonical(
        agentActionSigningPayload(action),
        input.signature!,
        publicKeyPem,
      ),
    );
  } catch {
    return false;
  }
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createGitHubAppJwt(
  config: Pick<GitHubRuntimeConfig, "appId" | "privateKeyPem">,
  now = new Date(),
): string {
  const issuedAt = Math.floor(now.getTime() / 1000) - 60;
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({
      iat: issuedAt,
      exp: issuedAt + 9 * 60,
      iss: config.appId,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(config.privateKeyPem).toString("base64url");
  return `${unsigned}.${signature}`;
}

async function readBoundedJson(
  response: Response,
  schema: z.ZodTypeAny,
): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_GITHUB_RESPONSE_BYTES
  ) {
    throw new GitHubVerificationError("GitHub response exceeded size limit");
  }

  const chunks: Uint8Array[] = [];
  let receivedBytes = 0;
  if (response.body) {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_GITHUB_RESPONSE_BYTES) {
        await reader.cancel();
        throw new GitHubVerificationError("GitHub response exceeded size limit");
      }
      chunks.push(value);
    }
  }
  const text = Buffer.concat(
    chunks.map((chunk) => Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength)),
  ).toString("utf8");
  if (!response.ok) {
    throw new GitHubVerificationError(
      `GitHub API returned HTTP ${response.status}`,
    );
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GitHubVerificationError("GitHub returned invalid JSON");
  }
  return schema.parse(json);
}

export class GitHubAppClient {
  constructor(
    private readonly config: GitHubRuntimeConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  private async request(
    path: string,
    schema: z.ZodTypeAny,
    init: RequestInit = {},
    token?: string,
  ): Promise<unknown> {
    const response = await this.fetchFn(`${GITHUB_API_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(GITHUB_TIMEOUT_MS),
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "proofrail-evidence-firewall",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
    return readBoundedJson(response, schema);
  }

  private async installationToken(repository: string): Promise<string> {
    const jwt = createGitHubAppJwt(this.config);
    const repoName = repository.split("/")[1]!;
    const token = (await this.request(
      `/app/installations/${this.config.installationId}/access_tokens`,
      InstallationTokenSchema,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${jwt}`,
          "Content-Type": "application/json",
        },
        body: canonicalStringify({
          repositories: [repoName],
          permissions: { actions: "read" },
        }),
      },
    )) as z.infer<typeof InstallationTokenSchema>;
    return token.token;
  }

  async verifyDeployment(input: {
    action: ProposedAction;
    delivery?: GitHubWorkflowDelivery;
  }): Promise<GitHubCiVerification> {
    const action = ProposedActionSchema.parse(input.action);
    const deployment = action.deployment;
    if (!deployment || action.scenarioId !== "agent_deploy") {
      throw new GitHubVerificationError(
        "GitHub CI verification only supports agent_deploy",
      );
    }
    const repository = deployment.repository.toLowerCase();
    if (!this.config.allowedRepositories.includes(repository)) {
      throw new GitHubVerificationError(
        "Repository is not allowed for this GitHub App integration",
      );
    }
    if (
      input.delivery &&
      (input.delivery.repository !== repository ||
        input.delivery.commitSha !== deployment.commitSha ||
        input.delivery.installationId !== this.config.installationId ||
        input.delivery.action !== "completed" ||
        input.delivery.status !== "completed" ||
        input.delivery.conclusion !== "success")
    ) {
      throw new GitHubVerificationError(
        "Webhook delivery does not prove a successful run for this action",
      );
    }

    const [owner, repo] = repository.split("/");
    const token = await this.installationToken(repository);
    let run: z.infer<typeof WorkflowRunSchema> | undefined;

    if (input.delivery) {
      run = (await this.request(
        `/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(repo!)}/actions/runs/${input.delivery.workflowRunId}`,
        WorkflowRunSchema,
        {},
        token,
      )) as z.infer<typeof WorkflowRunSchema>;
    } else {
      const runs = (await this.request(
        `/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(repo!)}/actions/runs?head_sha=${deployment.commitSha}&status=success&per_page=20`,
        WorkflowRunsSchema,
        {},
        token,
      )) as z.infer<typeof WorkflowRunsSchema>;
      run = runs.workflow_runs.find(
        (candidate) =>
          candidate.head_sha === deployment.commitSha &&
          candidate.status === "completed" &&
          candidate.conclusion === "success",
      );
    }

    if (
      !run ||
      run.head_sha !== deployment.commitSha ||
      run.status !== "completed" ||
      run.conclusion !== "success"
    ) {
      throw new GitHubVerificationError(
        "No successful completed workflow run exists for the exact commit",
      );
    }

    const artifacts = (await this.request(
      `/repos/${encodeURIComponent(owner!)}/${encodeURIComponent(repo!)}/actions/runs/${run.id}/artifacts?per_page=100`,
      ArtifactsSchema,
      {},
      token,
    )) as z.infer<typeof ArtifactsSchema>;
    const artifact = artifacts.artifacts.find(
      (candidate) =>
        !candidate.expired &&
        candidate.digest === deployment.artifactDigest &&
        (!candidate.workflow_run ||
          (candidate.workflow_run.id === run!.id &&
            candidate.workflow_run.head_sha === deployment.commitSha)),
    );
    if (!artifact) {
      throw new GitHubVerificationError(
        "No non-expired artifact with the exact digest exists for the workflow run",
      );
    }

    return {
      repository,
      commitSha: deployment.commitSha,
      artifactDigest: deployment.artifactDigest,
      workflowRunId: run.id,
      workflowName: run.name,
      workflowUrl: run.html_url,
      artifactId: artifact.id,
      artifactName: artifact.name,
      observedAt: run.updated_at,
    };
  }
}
