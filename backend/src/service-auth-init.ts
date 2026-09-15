import {
  generateKeyPairSync,
  randomBytes,
} from "node:crypto";
import { mkdir, open, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ServiceAuthFileSchema,
  hashServiceToken,
} from "./service-auth";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const dataDir =
  process.env.DATA_DIR ?? path.resolve(moduleDir, "../../data");
const privateDir = path.join(dataDir, "private");
const configPath =
  process.env.PROOFRAIL_SERVICE_AUTH_CONFIG ??
  path.join(privateDir, "service-auth.json");
const secretsPath =
  process.env.PROOFRAIL_SERVICE_AUTH_SECRETS ??
  path.join(privateDir, "service-auth-secrets.json");

async function assertMissing(target: string): Promise<void> {
  try {
    const handle = await open(target, "r");
    await handle.close();
    throw new Error(
      `Refusing to overwrite existing service authentication file: ${target}`,
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function writePrivateJson(
  target: string,
  value: unknown,
): Promise<void> {
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, JSON.stringify(value, null, 2), {
    encoding: "utf8",
    mode: 0o600,
  });
  await rename(temporary, target);
}

await mkdir(privateDir, { recursive: true });
await assertMissing(configPath);
await assertMissing(secretsPath);

const tokens = {
  "orchestrator-local": randomBytes(32).toString("base64url"),
  "human-reviewer-01": randomBytes(32).toString("base64url"),
  "executor-local": randomBytes(32).toString("base64url"),
  "operator-local": randomBytes(32).toString("base64url"),
};
const approverPair = generateKeyPairSync("ed25519");
const approverPublicKeyPem = approverPair.publicKey
  .export({ type: "spki", format: "pem" })
  .toString();
const approverPrivateKeyPem = approverPair.privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();

const config = ServiceAuthFileSchema.parse({
  schemaVersion: 1,
  principals: [
    {
      id: "orchestrator-local",
      kind: "orchestrator",
      scopes: [
        "state:read",
        "github:verify-ci",
        "evidence:collect",
        "decision:evaluate",
      ],
      tokenSha256: hashServiceToken(tokens["orchestrator-local"]),
    },
    {
      id: "human-reviewer-01",
      kind: "approver",
      scopes: ["state:read", "approval:create"],
      tokenSha256: hashServiceToken(tokens["human-reviewer-01"]),
    },
    {
      id: "executor-local",
      kind: "executor",
      scopes: ["state:read", "permit:execute"],
      tokenSha256: hashServiceToken(tokens["executor-local"]),
    },
    {
      id: "operator-local",
      kind: "operator",
      scopes: [
        "state:read",
        "scenario:select",
        "network:select",
        "evidence:expire",
        "evidence:raw:read",
        "simulation:run",
        "system:reset",
      ],
      tokenSha256: hashServiceToken(tokens["operator-local"]),
    },
  ],
  approverKeys: [
    {
      id: "approver-key-local",
      approverId: "human-reviewer-01",
      publicKeyPem: approverPublicKeyPem,
    },
  ],
});
const secrets = {
  schemaVersion: 1,
  tokens,
  approverIdentities: {
    "approver-key-local": {
      approverId: "human-reviewer-01",
      privateKeyPem: approverPrivateKeyPem,
    },
  },
};

try {
  await writePrivateJson(configPath, config);
  await writePrivateJson(secretsPath, secrets);
} catch (error) {
  throw new Error(
    "Service authentication initialization failed; inspect the private directory before retrying",
    { cause: error },
  );
}

console.log("Proofrail local service authentication initialized.");
console.log(`Trusted hashes and public keys: ${configPath}`);
console.log(`Client-only tokens and approver key: ${secretsPath}`);
console.log("No token or private key was printed.");
