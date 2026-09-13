import { loadEnvFile } from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProofrailApi } from "./app";

try {
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  for (const envFile of [".env", ".env.local"]) {
    try {
      loadEnvFile(path.resolve(moduleDir, `../../${envFile}`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
} catch (error) {
  throw error;
}

const port = Number(process.env.PORT ?? 3333);
const host = process.env.HOST ?? "127.0.0.1";
const app = await createProofrailApi();

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
