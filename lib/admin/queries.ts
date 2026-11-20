import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AuthError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { policyFor } from "@/lib/certificates/service";
import { db } from "@/lib/db";
import { listBackups } from "./backups";

/** Every admin read takes the viewer and re-checks the role (layouts are not a security boundary). */
export function assertAdmin(user: SessionUser) {
  if (user.role !== "ADMIN") throw new AuthError("FORBIDDEN");
}

export const PAGE_SIZE = 50;
const ROLES = ["STUDENT", "TEACHER", "PARENT", "ADMIN"] as const;
export type RoleName = (typeof ROLES)[number];
export const isRole = (v: unknown): v is RoleName => ROLES.includes(v as RoleName);

export async function getOverview(user: SessionUser, now = new Date()) {
  assertAdmin(user);
  const day = new Date(now.getTime() - 86_400_000);
  const [byRole, schools, classes, tasks, attempts, certificates, errors24h, recentAudit, recentErrors, backups] =
    await Promise.all([
      db.user.groupBy({ by: ["role"], _count: { _all: true }, where: { isActive: true } }),
      db.school.count(),
      db.schoolClass.count({ where: { archivedAt: null } }),
      db.task.count({ where: { status: "PUBLISHED" } }),
      db.attempt.count({ where: { status: { not: "IN_PROGRESS" } } }),
      db.certificate.count({ where: { revokedAt: null } }),
      db.errorLog.count({ where: { createdAt: { gte: day } } }),
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, action: true, createdAt: true, actor: { select: { login: true } } },
      }),
      db.errorLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, message: true, createdAt: true },
      }),
      listBackups(),
    ]);
  const users = Object.fromEntries(ROLES.map((r) => [r, byRole.find((x) => x.role === r)?._count._all ?? 0])) as Record<
    RoleName,
    number
  >;
  return {
    users,
    schools,
    classes,
    tasks,
    attempts,
    certificates,
    errors24h,
    recentAudit,
    recentErrors,
    lastBackup: backups[0] ?? null,
  };
}

export async function listUsers(
  user: SessionUser,
  { q = "", role, schoolId, page = 1 }: { q?: string; role?: RoleName; schoolId?: string; page?: number },
) {
  assertAdmin(user);
  const term = q.trim();
  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(schoolId ? { schoolId } : {}),
    ...(term
      ? {
          OR: [
            { login: { contains: term.toLowerCase() } },
            { firstName: { contains: term } },
            { lastName: { contains: term } },
          ],
        }
      : {}),
  };
  const [total, rows] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        login: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        school: { select: { name: true } },
      },
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getUserDetail(user: SessionUser, id: string) {
  assertAdmin(user);
  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      login: true,
      firstName: true,
      lastName: true,
      role: true,
      locale: true,
      isActive: true,
      schoolId: true,
      lastLoginAt: true,
      createdAt: true,
      _count: { select: { sessions: true, classesTaught: true } },
      childLinks: { select: { student: { select: { id: true, login: true, firstName: true, lastName: true } } } },
      parentLinks: { select: { parent: { select: { id: true, login: true, firstName: true, lastName: true } } } },
      memberships: { select: { class: { select: { name: true } } } },
    },
  });
}

export async function listSchools(user: SessionUser) {
  assertAdmin(user);
  return db.school.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, city: true, _count: { select: { users: true, classes: true } } },
  });
}

export async function getCatalogue(user: SessionUser) {
  assertAdmin(user);
  const [buildings, achievements, decorations] = await Promise.all([
    db.buildingType.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, key: true, nameKk: true, nameRu: true, isCore: true },
    }),
    db.achievement.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, key: true, nameKk: true, nameRu: true, descriptionKk: true, descriptionRu: true, rule: true },
    }),
    db.decoration.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, key: true, kind: true, nameKk: true, nameRu: true, costMaterials: true },
    }),
  ]);
  return { buildings, achievements, decorations };
}

export async function getCertificateAdmin(user: SessionUser, q = "") {
  assertAdmin(user);
  const term = q.trim();
  const [policy, template, certificates] = await Promise.all([
    policyFor(db, null),
    db.certificateTemplate.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, titleKk: true, titleRu: true },
    }),
    db.certificate.findMany({
      where: term
        ? {
            OR: [
              { serial: { contains: term.toUpperCase() } },
              { student: { firstName: { contains: term } } },
              { student: { lastName: { contains: term } } },
            ],
          }
        : {},
      orderBy: { issuedAt: "desc" },
      take: 100,
      select: {
        id: true,
        serial: true,
        tier: true,
        finalScore: true,
        issuedAt: true,
        revokedAt: true,
        revokedReason: true,
        student: { select: { firstName: true, lastName: true } },
        class: { select: { name: true } },
      },
    }),
  ]);
  return { policy, template, certificates };
}

export async function listAudit(
  user: SessionUser,
  { action = "", actor = "", page = 1 }: { action?: string; actor?: string; page?: number },
) {
  assertAdmin(user);
  const where: Prisma.AuditLogWhereInput = {
    ...(action.trim() ? { action: { startsWith: action.trim() } } : {}),
    ...(actor.trim() ? { actor: { login: actor.trim().toLowerCase() } } : {}),
  };
  const [total, rows] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        data: true,
        ip: true,
        createdAt: true,
        actor: { select: { login: true, role: true } },
      },
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function listErrors(user: SessionUser, page = 1) {
  assertAdmin(user);
  const [total, rows] = await Promise.all([
    db.errorLog.count(),
    db.errorLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { id: true, level: true, message: true, stack: true, context: true, createdAt: true },
    }),
  ]);
  return { total, rows, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
