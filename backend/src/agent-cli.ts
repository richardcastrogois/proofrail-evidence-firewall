import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateSigningIdentity, signCanonical } from "@rational/core";
import { ProposedActionSchema } from "@rational/shared";
import { agentActionSigningPayload } from "./github";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const command = process.argv[2];
const agentId = argument("--agent-id") ?? process.argv[3];
if (!agentId || !/^[A-Za-z0-9_.-]{1,120}$/.test(agentId)) {
  throw new Error("Provide an agent id with 1-120 letters, numbers, dots, underscores or hyphens");
}

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.DATA_DIR ?? path.resolve(moduleDir, "../../data");
const agentDir = path.join(dataDir, "private", "agents");
const privateKeyPath = path.join(agentDir, `${agentId}.private.pem`);
const publicKeyPath = path.join(agentDir, `${agentId}.public.pem`);

if (command === "keygen") {
  await mkdir(agentDir, { recursive: true });
  const identity = generateSigningIdentity();
  await writeFile(privateKeyPath, identity.privateKeyPem, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(publicKeyPath, identity.publicKeyPem, {
    encoding: "utf8",
    mode: 0o644,
    flag: "wx",
  });
  console.log(`Agent identity created: ${agentId}`);
  console.log(`Private key: ${privateKeyPath} (never share or commit)`);
  console.log(`Public key:  ${publicKeyPath}`);
  console.log(
    `PROOFRAIL_AGENT_PUBLIC_KEYS_JSON=${JSON.stringify({ [agentId]: [identity.publicKeyPem] })}`,
  );
} else if (command === "sign") {
  const actionPath = argument("--action") ?? process.argv[4];
  if (!actionPath) throw new Error("Provide the path to an action JSON file");
  const action = ProposedActionSchema.parse(
    JSON.parse(await readFile(path.resolve(actionPath), "utf8")),
  );
  if (action.deployment?.agentId !== agentId) {
    throw new Error("The action does not belong to the selected agent identity");
  }
  const privateKeyPem = await readFile(privateKeyPath, "utf8");
  console.log(signCanonical(agentActionSigningPayload(action), privateKeyPem));
} else {
  throw new Error("Use keygen <agent-id> or sign <agent-id> <action-json-path>");
}
