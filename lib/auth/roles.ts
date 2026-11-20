/**
 * Role ↔ cabinet routing rules. Pure and dependency-free: used by proxy.ts,
 * server guards, the login action and tests.
 */
import type { Role } from "@/generated/prisma/enums";

/** URL segment of each role's cabinet ("/student", "/teacher", ...). */
export const CABINET: Record<Role, "student" | "teacher" | "parent" | "admin"> = {
  STUDENT: "student",
  TEACHER: "teacher",
  PARENT: "parent",
  ADMIN: "admin",
};

const CABINET_ROLE = Object.fromEntries(Object.entries(CABINET).map(([role, seg]) => [seg, role])) as Record<
  string,
  Role
>;

/** Path (without locale) of the role's home page. */
export const homeFor = (role: Role) => `/${CABINET[role]}`;

/** The role that owns a path such as "/teacher/tasks", or null for public pages. */
export function cabinetRoleOf(pathname: string): Role | null {
  const segment = pathname.split("/")[1] ?? "";
  return CABINET_ROLE[segment] ?? null;
}

/**
 * Validates the `next` parameter after login: must be a local path (no
 * protocol-relative "//evil.com" or backslash tricks) and, if it points into a
 * cabinet, that cabinet must belong to the user's role. Returns a safe path.
 */
export function safeNextPath(next: string | null | undefined, role: Role): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return homeFor(role);
  const owner = cabinetRoleOf(next);
  if (owner && owner !== role) return homeFor(role);
  if (!owner) return homeFor(role); // after login always land in a cabinet
  return next;
}
