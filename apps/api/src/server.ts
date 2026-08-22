import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

try {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  loadEnvFile(path.resolve(moduleDir, "../../../.env"));
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const { JsonStore } = await import("./store");
const { registerRoutes } = await import("./routes");
const { loadServiceAuthenticator } = await import("./service-auth");
const {
  DisabledStagingExecutor,
  loadStagingExecutor,
} = await import("./executor");

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "127.0.0.1";

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL?.trim() || "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.headers.x-github-token",
        "req.headers.x-hub-signature-256",
        "res.headers.set-cookie",
        "*.token",
        "*.secret",
        "*.seed",
        "*.privateKeyPem",
      ],
      censor: "[REDACTED]",
    },
  },
  genReqId(request) {
    const supplied = request.headers["x-request-id"];
    return typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied)
      ? supplied
      : randomUUID();
  },
  bodyLimit: 256 * 1024,
  // The CLI ceiling is 10 minutes; keep Fastify alive long enough to return
  // the confirmed receipt or the adapter's explicit timeout response.
  requestTimeout: 660_000,
});

await app.register(cors, {
  origin: (origin, callback) => {
    if (
      origin === undefined ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      callback(null, true);
      return;
    }
    callback(new Error("Origin not allowed"), false);
  },
});

const store = new JsonStore();
await store.init();
const serviceAuthenticator = await loadServiceAuthenticator();
let stagingExecutor: import("./executor").StagingExecutor =
  new DisabledStagingExecutor();
try {
  stagingExecutor = await loadStagingExecutor();
} catch (error) {
  app.log.warn(
    {
      reason: error instanceof Error ? error.message : "unknown error",
    },
    "Staging executor is disabled",
  );
}
await registerRoutes(app, store, serviceAuthenticator, stagingExecutor);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    app.log.info({ signal }, "Shutting down Proofrail API");
    await app.close();
    process.exit(0);
  });
}
