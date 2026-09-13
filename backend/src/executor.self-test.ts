import assert from "node:assert/strict";
import {
  ExecutionNotAllowedError,
  ExecutorConfigSchema,
  GitHubWorkflowExecutor,
  __test,
  type StagingDispatch,
} from "./executor";

const config = ExecutorConfigSchema.parse({
  schemaVersion: 1,
  mode: "github_workflow",
  allowedRepositories: [
    "richardcastrogois/proofrail-evidence-firewall",
  ],
  allowedWorkflow: "staging-deploy.yml",
  workflowRef: "main",
  allowedServices: ["proofrail-demo"],
  allowedEnvironment: "staging",
  allowedTool: "deploy",
});

const dispatch: StagingDispatch = {
  repository: "richardcastrogois/proofrail-evidence-firewall",
  commitSha: "a91c4ad39ff6b8266d04cd22f13e4179f743a903",
  artifactDigest:
    "sha256:5f70bf18a086007016e948b04aed3b82103a36be44a0c13d57f656979435d25a",
  artifactId: 202,
  artifactName: "proofrail-web",
  workflowRunId: 101,
  serviceId: "proofrail-demo",
  environment: "staging",
  requestedTool: "deploy",
  requestId: "00000000-0000-4000-8000-000000000010",
  permitId: "00000000-0000-4000-8000-000000000011",
};

let receivedUrl = "";
let receivedAuthorization = "";
let receivedBody: Record<string, unknown> = {};
const request: typeof fetch = async (input, init) => {
  receivedUrl = String(input);
  receivedAuthorization = new Headers(init?.headers).get("authorization") ?? "";
  receivedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
  return new Response(
    JSON.stringify({
      workflow_run_id: 909,
      html_url:
        "https://github.com/richardcastrogois/proofrail-evidence-firewall/actions/runs/909",
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
};

const token = "executor-test-token-with-sufficient-entropy";
const executor = new GitHubWorkflowExecutor(config, token, request);
const result = await executor.dispatch(dispatch);
assert.match(receivedUrl, /staging-deploy\.yml\/dispatches$/);
assert.equal(receivedAuthorization, `Bearer ${token}`);
assert.equal(receivedBody.ref, "main");
assert.deepEqual(
  (receivedBody.inputs as Record<string, string>).commit_sha,
  dispatch.commitSha,
);
assert.deepEqual(
  (receivedBody.inputs as Record<string, string>).artifact_id,
  "202",
);
assert.doesNotMatch(JSON.stringify(receivedBody), /executor-test-token/);
assert.match(result.externalReference, /actions\/runs\/909$/);

if (process.platform !== "win32") {
  assert.equal(
    __test.normalizeConfigPath(
      "C:\\dev\\rational-gate\\data\\private\\executor.json",
    ),
    "/mnt/c/dev/rational-gate/data/private/executor.json",
  );
}

assert.throws(
  () =>
    executor.assertAllowed({
      ...dispatch,
      repository: "attacker/untrusted",
    }),
  ExecutionNotAllowedError,
);
assert.throws(
  () =>
    executor.assertAllowed({
      ...dispatch,
      serviceId: "production-root",
    }),
  ExecutionNotAllowedError,
);

console.log("Proofrail controlled executor self-test passed");
