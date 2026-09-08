import process from "node:process";
import { loadEnvFile } from "node:process";

for (const envFile of [".env", ".env.local"]) {
  try {
    loadEnvFile(envFile);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
const targetIndex = process.argv.indexOf("--target");
const target = targetArgument?.slice(9) ?? (targetIndex >= 0 ? process.argv[targetIndex + 1] : "api");
const value = (name) => process.env[name]?.trim() ?? "";
const issues = [];

if (target === "api") {
  const publicApiMode = value("PROOFRAIL_PUBLIC_API_MODE");
  if (!value("DATABASE_URL")) issues.push("DATABASE_URL is required before publishing the API.");
  if (value("PROOFRAIL_STORE") !== "postgres") issues.push("PROOFRAIL_STORE=postgres is required before publishing the API.");
  if (!value("PROOFRAIL_PUBLIC_ORIGINS")) issues.push("PROOFRAIL_PUBLIC_ORIGINS must contain the allowed browser origins for a public API.");
  if (publicApiMode === "limited") {
    if (value("MIDNIGHT_MODE") === "cli") issues.push("MIDNIGHT_MODE=cli cannot be enabled for the limited public API.");
  } else {
    if (value("MIDNIGHT_MODE") === "cli") issues.push("MIDNIGHT_MODE=cli requires the persistent Midnight worker and cannot run in a serverless API.");
    issues.push("The asynchronous Midnight worker is not implemented yet; publish the API only with PROOFRAIL_PUBLIC_API_MODE=limited.");
  }
}

if (issues.length > 0) {
  console.error(`Deployment preflight blocked for ${target}:`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log(`Deployment preflight passed for ${target}.`);
}
