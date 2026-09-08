import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const envFile of [".env", ".env.local"]) {
  const envPath = path.join(rootDir, envFile);
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

const prismaCli = path.join(
  rootDir,
  "node_modules",
  "prisma",
  "build",
  "index.js",
);

const child = spawn(process.execPath, [prismaCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : "Failed to run Prisma");
  process.exit(1);
});
