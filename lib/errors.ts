import "server-only";
import { db } from "@/lib/db";

/**
 * Writes the error journal (spec §11, shown on /admin/logs). Never throws.
 * Context must not contain personal data, cookies or request bodies.
 */
export async function logError(
  error: unknown,
  context: Record<string, string | number | boolean | null | undefined> = {},
  level: "error" | "warn" = "error",
) {
  try {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    const digest = typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;
    await db.errorLog.create({
      data: {
        level,
        message: message.slice(0, 1000),
        stack: stack?.slice(0, 8000),
        context: { ...context, ...(digest ? { digest } : {}) },
      },
    });
  } catch (writeError) {
    console.error("error log write failed", writeError);
  }
}
