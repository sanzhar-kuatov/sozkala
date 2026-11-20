import "server-only";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { redirect } from "@/i18n/navigation";
import { db } from "@/lib/db";
import { homeFor } from "./roles";
import { getSession, type SessionUser } from "./session";

/**
 * Authorization helpers — the real security boundary (proxy.ts only does
 * optimistic redirects). Rules:
 *  - Pages call `requireRole()`; it redirects to /login or to the user's own cabinet.
 *  - Server Actions and Route Handlers call `authorize()`; it throws instead of redirecting.
 *  - Every query about a student goes through `canViewStudent()` / `viewableStudentIds()`.
 *  - Parents are read-only everywhere (spec §2.3, acceptance tests 6–7).
 */

export class AuthError extends Error {
  constructor(public readonly code: "UNAUTHENTICATED" | "FORBIDDEN") {
    super(code);
    this.name = "AuthError";
  }
}

/** Signed-in user or null (no redirect). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/** For pages and layouts: signed-in user with one of `roles`, otherwise redirect. */
export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  // proxy.ts already sends signed-out visitors to /login?next=…; this is the server-side backstop.
  if (!user) return redirect({ href: "/login", locale });
  if (roles.length > 0 && !roles.includes(user.role)) {
    return redirect({ href: homeFor(user.role), locale });
  }
  return user;
}

/**
 * For Server Actions / Route Handlers: returns the user or throws AuthError.
 * `write: true` additionally rejects parents (read-only role).
 */
export async function authorize(roles: Role[] = [], opts: { write?: boolean } = {}): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("UNAUTHENTICATED");
  if (roles.length > 0 && !roles.includes(user.role)) throw new AuthError("FORBIDDEN");
  if (opts.write && user.role === "PARENT") throw new AuthError("FORBIDDEN");
  return user;
}

/**
 * Ids of the students this user may see:
 *  student → only themself · parent → linked children · teacher → students of
 *  their (non-archived) classes · admin → everyone (returns "all").
 */
export const viewableStudentIds = cache(async (user: SessionUser): Promise<string[] | "all"> => {
  switch (user.role) {
    case "ADMIN":
      return "all";
    case "STUDENT":
      return [user.id];
    case "PARENT":
      return (await db.parentLink.findMany({ where: { parentId: user.id }, select: { studentId: true } })).map(
        (l) => l.studentId,
      );
    case "TEACHER":
      return (
        await db.classMember.findMany({
          where: { class: { teacherId: user.id, archivedAt: null } },
          select: { studentId: true },
          distinct: ["studentId"],
        })
      ).map((m) => m.studentId);
  }
});

export async function canViewStudent(user: SessionUser, studentId: string): Promise<boolean> {
  const ids = await viewableStudentIds(user);
  return ids === "all" || ids.includes(studentId);
}

/** Throws FORBIDDEN unless the user may see this student's data. */
export async function assertCanViewStudent(user: SessionUser, studentId: string) {
  if (!(await canViewStudent(user, studentId))) throw new AuthError("FORBIDDEN");
}
