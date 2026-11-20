/**
 * Signed session token (HS256 JWT) stored in an httpOnly cookie.
 * It carries only the session id, user id and role — no personal data.
 * Used by proxy.ts for optimistic redirects (no DB access there) and by
 * lib/auth/session.ts, which additionally checks the Session row in the DB.
 */
import { jwtVerify, SignJWT } from "jose";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "sz_session";
export const SESSION_TTL_DAYS = 14;

export type SessionClaims = { sid: string; uid: string; role: Role };

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET is missing or shorter than 32 characters");
  return new TextEncoder().encode(secret);
}

export async function signSessionToken(claims: SessionClaims, expiresAt: Date): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key());
}

/** Returns the claims, or null when the token is missing, tampered with or expired. */
export async function verifySessionToken(token: string | undefined): Promise<SessionClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const { sid, uid, role } = payload as Partial<SessionClaims>;
    if (typeof sid !== "string" || typeof uid !== "string" || typeof role !== "string") return null;
    return { sid, uid, role };
  } catch {
    return null;
  }
}
