import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { PrismaClient } from "@prisma/client";

for (const envFile of [".env", ".env.local"]) {
  if (existsSync(envFile)) {
    loadEnvFile(envFile);
  }
}

const prisma = new PrismaClient();

try {
  const migrations = await prisma.$queryRaw`
    select migration_name, finished_at is not null as finished
    from _prisma_migrations
    order by finished_at
  `;
  const tables = await prisma.$queryRaw`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'
    order by table_name
  `;

  console.log(
    JSON.stringify({
      migrations,
      tableCount: tables.length,
      tables: tables.map((row) => row.table_name),
    }),
  );
} finally {
  await prisma.$disconnect();
}
