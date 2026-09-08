import Fastify from "fastify";
import cors from "@fastify/cors";
import { randomUUID } from "node:crypto";
import { JsonStore } from "./store";
import { PostgresStateStore } from "./postgres-store";
import { registerRoutes } from "./routes";
import { isAllowedBrowserOrigin } from "./runtime-config";
import { loadServiceAuthenticator } from "./service-auth";
import {
  DisabledStagingExecutor,
  loadStagingExecutor,
} from "./executor";

export async function createProofrailApi() {
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
    requestTimeout: 660_000,
  });

  await app.register(cors, {
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allowed: boolean) => void,
    ) => {
      if (isAllowedBrowserOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Origin not allowed"), false);
    },
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("cache-control", "no-store");
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "no-referrer");
    return payload;
  });

  const store =
    process.env.PROOFRAIL_STORE === "postgres"
      ? new PostgresStateStore()
      : new JsonStore();
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
  return app;
}
