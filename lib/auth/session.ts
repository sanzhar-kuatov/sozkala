import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { SESSION_COOKIE, SESSION_TTL_DAYS, signSessionToken, verifySessionToken } from "./token";

/** Fields of the signed-in user that pages may use. Never includes the password hash. */
export const sessionUserSelect = {
  id: true,
  login: true,
  role: true,
  firstName: true,
  lastName: true,
  locale: true,
  isActive: true,
  schoolId: true,
} as const;

export type SessionUser = {
  id: string;
  login: string;
  role: "STUDENT" | "TEACHER" | "PARENT" | "ADMIN";
  firstName: string;
  lastName: string;
  locale: "kk" | "ru";
  isActive: boolean;
  schoolId: string | null;
};

/** Client IP and user agent of the current request (for sessions and the audit log). */
export async function requestMeta() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ip, userAgent: h.get("user-agent")?.slice(0, 300) ?? null };
}

/** Creates a Session row and sets the cookie. Call only from Server Actions / Route Handlers. */
export async function createSession(user: { id: string; role: SessionUser["role"] }) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const { ip, userAgent } = await requestMeta();
  const session = await db.session.create({ data: { userId: user.id, expiresAt, ip, userAgent } });
  const token = await signSessionToken({ sid: session.id, uid: user.id, role: user.role }, expiresAt);

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    // Secure whenever the site is served over HTTPS (production, Vercel, PS Cloud). An offline
    // school-network install runs on plain http://<server-ip>, where browsers would drop a
    // Secure cookie, so it follows APP_URL (docs/deploy-offline.md).
    secure: env.NODE_ENV === "production" && env.APP_URL.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return session;
}

/**
 * The signed-in user for this request, or null. Verifies the token signature,
 * then that the Session row still exists, has not expired and the account is
 * active — so logout, deactivation and role changes take effect immediately.
 * Memoized per render with React `cache`.
 */
export const getSession = cache(async (): Promise<{ sessionId: string; user: SessionUser } | null> => {
  const claims = await verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
  if (!claims) return null;

  const session = await db.session.findUnique({
    where: { id: claims.sid },
    select: { id: true, expiresAt: true, userId: true, user: { select: sessionUserSelect } },
  });
  if (!session || session.userId !== claims.uid || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }
  return { sessionId: session.id, user: session.user };
});

/** Deletes the current session (DB row + cookie). */
export async function deleteSession() {
  const store = await cookies();
  const claims = await verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (claims) await db.session.deleteMany({ where: { id: claims.sid } });
  store.delete(SESSION_COOKIE);
}

/** Signs a user out everywhere (e.g. after deactivation or a password reset). */
export async function deleteAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}
