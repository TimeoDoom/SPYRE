import "server-only";

import { PrismaClient } from "@prisma/client";

function resolveSqliteDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (url?.startsWith("file:")) return url;

  // Keep local development resilient when an external env overrides DATABASE_URL
  // with a non-SQLite URL while schema provider is `sqlite`.
  return "file:./prisma/dev.db";
}

const databaseUrl = resolveSqliteDatabaseUrl();
export const isDbEnabled = databaseUrl.length > 0;

const globalForPrisma = globalThis as unknown as {
  __mailappPrisma?: PrismaClient;
};

export const prisma: PrismaClient | null = (() => {
  if (!isDbEnabled) return null;

  if (!globalForPrisma.__mailappPrisma) {
    globalForPrisma.__mailappPrisma = new PrismaClient({
      datasources: {
        db: { url: databaseUrl },
      },
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForPrisma.__mailappPrisma;
})();
