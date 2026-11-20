import "server-only";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

/**
 * Single PrismaClient per server process. In development, Next.js hot reload
 * re-evaluates modules, so the instance is cached on globalThis to avoid
 * opening a new connection pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaLibSql({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
  return new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const db = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") globalForPrisma.prisma = db;

/**
 * SQLite tuning, applied once per process:
 *  - WAL journal: readers and the single writer no longer block each other
 *    (many students solving tasks at the same time). Stored in the DB file.
 *  - busy_timeout: a writer waits up to 5 s for the lock instead of failing.
 */
const tuned = globalThis as unknown as { sqliteTuned?: Promise<void> };
// Skipped during `next build` (parallel build workers would only contend for the lock)
// and for a hosted database (Turso manages its own journal).
if (process.env.NEXT_PHASE !== "phase-production-build" && env.DATABASE_URL.startsWith("file:"))
  tuned.sqliteTuned ??= (async () => {
    try {
      await db.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
      await db.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
    } catch (error) {
      console.error("SQLite tuning failed", error);
    }
  })();
