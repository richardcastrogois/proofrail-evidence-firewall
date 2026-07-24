import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile();
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
  logger: true,
  bodyLimit: 256 * 1024,
  requestTimeout: 420_000,
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
