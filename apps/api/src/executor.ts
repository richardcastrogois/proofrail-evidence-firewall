import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const defaultConfigPath = path.resolve(
  moduleDir,
  "../../../data/private/executor.json",
);
const GITHUB_API_VERSION = "2026-03-10";
const MAX_RESPONSE_BYTES = 256 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

const RepositorySchema = z
  .string()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);

export const ExecutorConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    mode: z.literal("github_workflow"),
    allowedRepositories: z.array(RepositorySchema).min(1).max(20),
    allowedWorkflow: z
      .string()
      .regex(/^[A-Za-z0-9_.-]+\.(?:yml|yaml)$/),
    workflowRef: z.string().regex(/^[A-Za-z0-9._/-]+$/).max(255),
    allowedServices: z
      .array(z.string().regex(/^[A-Za-z0-9_.-]+$/))
      .min(1)
      .max(20),
    allowedEnvironment: z.literal("staging"),
    allowedTool: z.literal("deploy"),
    tokenEnv: z
      .literal("PROOFRAIL_EXECUTOR_GITHUB_TOKEN")
      .default("PROOFRAIL_EXECUTOR_GITHUB_TOKEN"),
    apiUrl: z
      .literal("https://api.github.com")
      .default("https://api.github.com"),
  })
  .strict()
  .superRefine((config, context) => {
    if (new Set(config.allowedRepositories).size !== config.allowedRepositories.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowedRepositories"],
        message: "Executor repository allowlist contains duplicates",
      });
    }
    if (new Set(config.allowedServices).size !== config.allowedServices.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowedServices"],
        message: "Executor service allowlist contains duplicates",
      });
    }
  });
export type ExecutorConfig = z.infer<typeof ExecutorConfigSchema>;

export interface StagingDispatch {
  repository: string;
  commitSha: string;
  artifactDigest: string;
  artifactId: number;
  artifactName: string;
  workflowRunId: number;
  serviceId: string;
  environment: "staging";
  requestedTool: "deploy";
  requestId: string;
  permitId: string;
}

export interface StagingExecutor {
  assertAllowed(input: StagingDispatch): void;
  dispatch(input: StagingDispatch): Promise<{ externalReference: string }>;
}

export class ExecutionNotAllowedError extends Error {}
export class ExternalExecutionError extends Error {}

export class DisabledStagingExecutor implements StagingExecutor {
  assertAllowed(): void {
    throw new ExecutionNotAllowedError(
      "The staging executor is not configured",
    );
  }

  async dispatch(): Promise<{ externalReference: string }> {
    throw new ExecutionNotAllowedError(
      "The staging executor is not configured",
    );
  }
}

export class GitHubWorkflowExecutor implements StagingExecutor {
  constructor(
    readonly config: ExecutorConfig,
    private readonly token: string,
    private readonly request: typeof fetch = fetch,
  ) {
    if (token.trim().length < 20) {
      throw new Error("The executor GitHub token is missing or too short");
    }
  }

  assertAllowed(input: StagingDispatch): void {
    if (
      !this.config.allowedRepositories.includes(input.repository) ||
      !this.config.allowedServices.includes(input.serviceId) ||
      input.environment !== this.config.allowedEnvironment ||
      input.requestedTool !== this.config.allowedTool
    ) {
      throw new ExecutionNotAllowedError(
        "The permit target is outside the executor allowlist",
      );
    }
  }

  async dispatch(
    input: StagingDispatch,
  ): Promise<{ externalReference: string }> {
    this.assertAllowed(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const workflow = encodeURIComponent(this.config.allowedWorkflow);
    const url = `${this.config.apiUrl}/repos/${input.repository}/actions/workflows/${workflow}/dispatches`;
    let response: Response;
    try {
      response = await this.request(url, {
        method: "POST",
        headers: {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "x-github-api-version": GITHUB_API_VERSION,
        },
        body: JSON.stringify({
          ref: this.config.workflowRef,
          inputs: {
            commit_sha: input.commitSha,
            artifact_digest: input.artifactDigest,
            artifact_id: String(input.artifactId),
            artifact_name: input.artifactName,
            source_workflow_run_id: String(input.workflowRunId),
            service_id: input.serviceId,
            request_id: input.requestId,
            permit_id: input.permitId,
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new ExternalExecutionError(
        "GitHub workflow dispatch could not be reached",
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }

    const body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) {
      throw new ExternalExecutionError(
        "GitHub workflow dispatch returned an oversized response",
      );
    }
    if (!response.ok) {
      throw new ExternalExecutionError(
        `GitHub workflow dispatch failed with status ${response.status}`,
      );
    }

    let externalReference =
      response.headers.get("location") ??
      `github:${input.repository}:${this.config.allowedWorkflow}:${input.requestId}`;
    if (body) {
      try {
        const parsed = z
          .object({
            html_url: z.string().url().optional(),
            workflow_run_id: z.number().int().positive().optional(),
          })
          .passthrough()
          .parse(JSON.parse(body));
        externalReference =
          parsed.html_url ??
          (parsed.workflow_run_id
            ? `github:${input.repository}:run:${parsed.workflow_run_id}`
            : externalReference);
      } catch {
        // A successful response body is optional and not trusted for dispatch.
      }
    }
    return { externalReference };
  }
}

export async function loadStagingExecutor(
  env: NodeJS.ProcessEnv = process.env,
): Promise<StagingExecutor> {
  const configPath = path.resolve(
    env.PROOFRAIL_EXECUTOR_CONFIG ?? defaultConfigPath,
  );
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Executor configuration is unavailable at ${configPath}`,
      { cause: error },
    );
  }
  const config = ExecutorConfigSchema.parse(parsed);
  const token = env[config.tokenEnv];
  if (!token) {
    throw new Error(
      `Executor credential ${config.tokenEnv} is unavailable`,
    );
  }
  return new GitHubWorkflowExecutor(config, token);
}
