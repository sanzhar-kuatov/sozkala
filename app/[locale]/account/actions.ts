"use server";

import { z } from "zod";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";

export type PasswordState = { ok?: boolean; error?: "current" | "short" | "mismatch" | "same" } | undefined;

const schema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().max(200),
  confirm: z.string().max(200),
});

/**
 * Every user (parents too — it is their own account, not student data) can
 * replace a temporary password. Other devices are signed out.
 */
export async function changePassword(_prev: PasswordState, fd: FormData): Promise<PasswordState> {
  const user = await authorize();
  const parsed = schema.safeParse({ current: fd.get("current"), next: fd.get("next"), confirm: fd.get("confirm") });
  if (!parsed.success) return { error: "current" };
  const { current, next, confirm } = parsed.data;

  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await verifyPassword(row.passwordHash, current))) {
    await audit({ actorId: user.id, action: "auth.password.change.failed", entity: "User", entityId: user.id });
    return { error: "current" };
  }
  if (next.length < MIN_PASSWORD_LENGTH) return { error: "short" };
  if (next !== confirm) return { error: "mismatch" };
  if (next === current) return { error: "same" };

  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await deleteAllSessions(user.id);
  await createSession(user); // this device stays signed in
  await audit({ actorId: user.id, action: "auth.password.change", entity: "User", entityId: user.id });
  return { ok: true };
}
