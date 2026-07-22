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
await registerRoutes(app, store);

try {
  await app.listen({ port, host });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
