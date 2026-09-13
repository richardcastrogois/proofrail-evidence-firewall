import { build } from "esbuild";

await build({
  entryPoints: ["backend/src/vercel-entry.ts"],
  outfile: "dist-vercel/api-handler.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  sourcemap: false,
  external: ["@prisma/client", ".prisma/client", "@prisma/*"],
  logLevel: "info",
});
