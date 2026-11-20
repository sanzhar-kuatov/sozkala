import "server-only";
import { requestMeta } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * Writes an entry to the audit log (spec §11 "history of changes").
 * Never throws: a failed audit write must not break the user's action.
 */
export async function audit(entry: {
  actorId?: string | null;
  action: string; // "auth.login", "task.create", ...
  entity: string; // "User", "Task", ...
  entityId?: string | null;
  data?: Record<string, unknown>;
}) {
  try {
    const { ip } = await requestMeta();
    await db.auditLog.create({
      data: {
        actorId: entry.actorId ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        data: entry.data ? (entry.data as object) : undefined,
        ip,
      },
    });
  } catch (error) {
    console.error("audit log write failed", error);
  }
}
