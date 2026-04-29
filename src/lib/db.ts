import "server-only";

import { PrismaClient } from "@prisma/client";

function isDbUrlConfigured() {
  const url = process.env.DATABASE_URL;
  return typeof url === "string" && url.trim().length > 0;
}

export const isDbEnabled = isDbUrlConfigured();

const globalForPrisma = globalThis as unknown as {
  __mailappPrisma?: PrismaClient;
};

export const prisma: PrismaClient | null = (() => {
  if (!isDbEnabled) return null;

  if (!globalForPrisma.__mailappPrisma) {
    globalForPrisma.__mailappPrisma = new PrismaClient({
      log:
        process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }

  return globalForPrisma.__mailappPrisma;
})();
