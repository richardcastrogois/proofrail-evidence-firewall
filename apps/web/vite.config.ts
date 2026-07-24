import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  defineConfig,
  loadEnv,
  type ProxyOptions,
} from "vite";
import react from "@vitejs/plugin-react";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(async ({ command, mode }) => {
  const env = loadEnv(mode, path.resolve(moduleDir, "../.."), "");
  let tokens: Record<string, string> = {};
  if (command === "serve") {
    const secretsPath =
      env.PROOFRAIL_SERVICE_AUTH_SECRETS ||
      path.resolve(
        moduleDir,
        "../../data/private/service-auth-secrets.json",
      );
    const parsed = JSON.parse(await readFile(secretsPath, "utf8")) as {
      tokens?: Record<string, string>;
    };
    tokens = parsed.tokens ?? {};
  }

  function tokenForRoute(url: string): string | undefined {
    if (
      url.startsWith("/api/evidence/") ||
      url === "/api/evaluate" ||
      url.startsWith("/api/integrations/github/verify-ci")
    ) {
      return tokens["orchestrator-local"];
    }
    if (url === "/api/execute") {
      return tokens["executor-local"];
    }
    return tokens["operator-local"];
  }

  const apiProxy: ProxyOptions = {
    target: "http://127.0.0.1:3333",
    configure(proxy) {
      proxy.on("proxyReq", (proxyRequest, request) => {
        const token = tokenForRoute(request.url ?? "");
        if (token) {
          proxyRequest.setHeader(
            "authorization",
            `Bearer ${token}`,
          );
        }
      });
    },
  };

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": apiProxy,
      },
    },
  };
});
