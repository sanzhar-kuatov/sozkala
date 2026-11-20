"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { hashPassword, verifyPassword } from "./password";
import { safeNextPath } from "./roles";
import { createSession, deleteSession, getSession, requestMeta } from "./session";

export type LoginState = { error?: "invalid" | "inactive" | "throttled" | "required"; login?: string } | undefined;

/** Spec §11: at most N failed logins per account in 15 minutes (N = admin setting, default 5). */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
/** Failed logins from one IP address (any account) in the same window — slows down password spraying. */
const MAX_FAILURES_PER_IP = 30;

const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1).max(64),
  password: z.string().min(1).max(200),
  next: z.string().max(500).optional(),
});

// A real hash to verify against when the login does not exist, so the response
// time does not reveal which logins are registered.
let dummyHash: Promise<string> | undefined;

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    login: formData.get("login"),
    password: formData.get("password"),
    next: formData.get("next") || undefined,
  });
  if (!parsed.success) return { error: "required", login: String(formData.get("login") ?? "") };
  const { login, password, next } = parsed.data;

  const recentFailures = await db.auditLog.count({
    where: {
      action: "auth.login.failed",
      entityId: login,
      createdAt: { gte: new Date(Date.now() - FAILURE_WINDOW_MS) },
    },
  });
  if (recentFailures >= (await getSetting("auth.maxLoginFailures"))) return { error: "throttled", login };
  const { ip } = await requestMeta();
  if (ip) {
    const fromIp = await db.auditLog.count({
      where: { action: "auth.login.failed", ip, createdAt: { gte: new Date(Date.now() - FAILURE_WINDOW_MS) } },
    });
    if (fromIp >= MAX_FAILURES_PER_IP) return { error: "throttled", login };
  }

  const user = await db.user.findUnique({
    where: { login },
    select: { id: true, role: true, passwordHash: true, isActive: true },
  });
  const ok = await verifyPassword(
    user?.passwordHash ?? (await (dummyHash ??= hashPassword("dummy-password"))),
    password,
  );

  if (!user || !ok) {
    await audit({ actorId: user?.id, action: "auth.login.failed", entity: "Login", entityId: login });
    return { error: "invalid", login };
  }
  if (!user.isActive) {
    await audit({ actorId: user.id, action: "auth.login.inactive", entity: "User", entityId: user.id });
    return { error: "inactive", login };
  }

  await createSession(user);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: "auth.login", entity: "User", entityId: user.id });

  // redirect() throws, so it must stay outside any try/catch.
  redirect({ href: safeNextPath(next, user.role), locale: await getLocale() });
}

export async function logout() {
  const session = await getSession();
  await deleteSession();
  if (session)
    await audit({ actorId: session.user.id, action: "auth.logout", entity: "User", entityId: session.user.id });
  redirect({ href: "/login", locale: await getLocale() });
}
