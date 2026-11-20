"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { backupsSupported, createBackup, deleteBackup } from "@/lib/admin/backups";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { deleteAllSessions } from "@/lib/auth/session";
import { policyError } from "@/lib/certificates/rules";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { createCityForStudent } from "@/lib/domain/city";
import { SETTING_SCHEMAS, saveSettings } from "@/lib/settings";
import { deleteAudioFiles } from "@/lib/storage";
import { suggestLogin, temporaryPassword } from "@/lib/teacher/access";

export type Credentials = { name: string; login: string; password: string };
export type AdminResult = { ok?: boolean; error?: string; created?: Credentials } | undefined;

const refresh = () => revalidatePath("/[locale]/admin", "layout");
const admin = () => authorize(["ADMIN"], { write: true });
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

const roleSchema = z.enum(["STUDENT", "TEACHER", "PARENT", "ADMIN"]);
const nameSchema = z.string().trim().min(1).max(50);
const loginSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/);

// ---- users ------------------------------------------------------------------

/** New account with a temporary password shown once (spec §2.4: users and roles). */
export async function createUser(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = z
    .object({
      role: roleSchema,
      firstName: nameSchema,
      lastName: nameSchema,
      login: z.union([z.literal(""), loginSchema]),
      schoolId: z.string().max(40),
    })
    .safeParse({
      role: str(fd, "role"),
      firstName: str(fd, "firstName"),
      lastName: str(fd, "lastName"),
      login: str(fd, "login").toLowerCase(),
      schoolId: str(fd, "schoolId"),
    });
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;
  if (v.schoolId && !(await db.school.findUnique({ where: { id: v.schoolId }, select: { id: true } }))) {
    return { error: "invalid" };
  }
  const login = v.login || (await suggestLogin(v.firstName, v.lastName));
  if (await db.user.findUnique({ where: { login }, select: { id: true } })) return { error: "loginTaken" };

  const password = temporaryPassword();
  const created = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        login,
        passwordHash: await hashPassword(password),
        role: v.role,
        firstName: v.firstName,
        lastName: v.lastName,
        schoolId: v.schoolId || null,
      },
      select: { id: true },
    });
    if (v.role === "STUDENT") await createCityForStudent(tx, u.id, `${v.firstName}-қала`);
    return u;
  });
  await audit({
    actorId: user.id,
    action: "user.create",
    entity: "User",
    entityId: created.id,
    data: { role: v.role },
  });
  refresh();
  return { created: { name: `${v.firstName} ${v.lastName}`, login, password } };
}

export async function updateUser(id: string, _prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = z
    .object({
      firstName: nameSchema,
      lastName: nameSchema,
      role: roleSchema,
      locale: z.enum(["kk", "ru"]),
      schoolId: z.string().max(40),
      isActive: z.boolean(),
    })
    .safeParse({
      firstName: str(fd, "firstName"),
      lastName: str(fd, "lastName"),
      role: str(fd, "role"),
      locale: str(fd, "locale"),
      schoolId: str(fd, "schoolId"),
      isActive: fd.get("isActive") === "on",
    });
  if (!parsed.success) return { error: "invalid" };
  const v = parsed.data;

  const current = await db.user.findUnique({
    where: { id },
    select: { role: true, isActive: true, _count: { select: { classesTaught: true } }, city: { select: { id: true } } },
  });
  if (!current) return { error: "invalid" };
  // An admin cannot lock themselves out.
  if (id === user.id && (v.role !== "ADMIN" || !v.isActive)) return { error: "self" };
  // A teacher's classes would be left without a teacher.
  if (current.role === "TEACHER" && v.role !== "TEACHER" && current._count.classesTaught > 0) {
    return { error: "hasClasses" };
  }
  if (v.schoolId && !(await db.school.findUnique({ where: { id: v.schoolId }, select: { id: true } }))) {
    return { error: "invalid" };
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { ...v, schoolId: v.schoolId || null },
    });
    if (v.role === "STUDENT" && !current.city) await createCityForStudent(tx, id, `${v.firstName}-қала`);
  });
  // The role sits in the session token, and a deactivated user must be signed out at once.
  if (v.role !== current.role || (!v.isActive && current.isActive)) await deleteAllSessions(id);

  await audit({
    actorId: user.id,
    action: v.role !== current.role ? "user.role.change" : "user.update",
    entity: "User",
    entityId: id,
    data: { role: v.role, from: current.role, isActive: v.isActive },
  });
  refresh();
  return { ok: true };
}

export async function resetPassword(id: string): Promise<AdminResult> {
  const user = await admin();
  if (id === user.id) return { error: "self" };
  const password = temporaryPassword();
  const target = await db.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(password) },
    select: { firstName: true, lastName: true, login: true },
  });
  await deleteAllSessions(id);
  await audit({ actorId: user.id, action: "user.password.reset", entity: "User", entityId: id });
  return { created: { name: `${target.firstName} ${target.lastName}`, login: target.login, password } };
}

/**
 * Right to erasure (Law of the RK No. 94-V): deletes the account with its city,
 * answers, recordings, rewards, certificates and notifications. Authors of tasks
 * or classes are refused (their content is used by others) — block them instead.
 */
export async function deleteUser(id: string): Promise<AdminResult> {
  const user = await admin();
  if (id === user.id) return { error: "self" };
  const target = await db.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return { error: "invalid" };
  const attempts = await db.attempt.findMany({ where: { studentId: id }, select: { id: true } });
  try {
    await db.user.delete({ where: { id } });
  } catch (error) {
    // Restrict relations: tasks, topics, classes or grades made by this user
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2003", "P2014"].includes(error.code)) {
      return { error: "hasContent" };
    }
    throw error;
  }
  const files = await deleteAudioFiles(attempts.map((a) => a.id));
  // The audit entry keeps no personal data: only the id and role of the deleted account.
  await audit({
    actorId: user.id,
    action: "user.delete",
    entity: "User",
    entityId: id,
    data: { role: target.role, files },
  });
  revalidatePath("/[locale]/admin", "layout");
  redirect({ href: "/admin/users", locale: await getLocale() });
  return { ok: true };
}

export async function signOutEverywhere(id: string) {
  const user = await admin();
  await deleteAllSessions(id);
  await audit({ actorId: user.id, action: "user.sessions.revoke", entity: "User", entityId: id });
  refresh();
}

/** Parent ↔ student link by the student's login (spec §2.3). */
export async function linkChild(parentId: string, _prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parent = await db.user.findUnique({ where: { id: parentId }, select: { role: true } });
  const student = await db.user.findUnique({
    where: { login: str(fd, "studentLogin").toLowerCase() },
    select: { id: true, role: true },
  });
  if (parent?.role !== "PARENT") return { error: "invalid" };
  if (!student || student.role !== "STUDENT") return { error: "studentNotFound" };
  await db.parentLink.upsert({
    where: { parentId_studentId: { parentId, studentId: student.id } },
    update: {},
    create: { parentId, studentId: student.id },
  });
  await audit({ actorId: user.id, action: "parent.link", entity: "User", entityId: student.id, data: { parentId } });
  refresh();
  return { ok: true };
}

export async function unlinkChild(parentId: string, studentId: string) {
  const user = await admin();
  await db.parentLink.deleteMany({ where: { parentId, studentId } });
  await audit({ actorId: user.id, action: "parent.unlink", entity: "User", entityId: studentId, data: { parentId } });
  refresh();
}

// ---- schools ----------------------------------------------------------------

const schoolSchema = z.object({ name: z.string().trim().min(2).max(120), city: z.string().trim().max(60) });

export async function saveSchool(id: string | null, _prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = schoolSchema.safeParse({ name: str(fd, "name"), city: str(fd, "city") });
  if (!parsed.success) return { error: "invalid" };
  const data = { name: parsed.data.name, city: parsed.data.city || null };
  const school = id
    ? await db.school.update({ where: { id }, data, select: { id: true } })
    : await db.school.create({ data, select: { id: true } });
  await audit({
    actorId: user.id,
    action: id ? "school.update" : "school.create",
    entity: "School",
    entityId: school.id,
  });
  refresh();
  return { ok: true };
}

export async function deleteSchool(id: string): Promise<AdminResult> {
  const user = await admin();
  const school = await db.school.findUnique({
    where: { id },
    select: { _count: { select: { users: true, classes: true } } },
  });
  if (!school) return { error: "invalid" };
  if (school._count.users + school._count.classes > 0) return { error: "schoolNotEmpty" };
  await db.school.delete({ where: { id } });
  await audit({ actorId: user.id, action: "school.delete", entity: "School", entityId: id });
  refresh();
  return { ok: true };
}

// ---- catalogue: buildings, badges, decorations ------------------------------

/** Which buildings are "main" (count for the certificate, spec §7). */
export async function saveCoreBuildings(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const types = await db.buildingType.findMany({ select: { id: true, key: true } });
  const core = types.filter((t) => fd.get(`core_${t.key}`) === "on").map((t) => t.key);
  if (core.length === 0) return { error: "noCore" };
  await db.$transaction(
    types.map((t) => db.buildingType.update({ where: { id: t.id }, data: { isCore: core.includes(t.key) } })),
  );
  await audit({ actorId: user.id, action: "catalogue.buildings.update", entity: "BuildingType", data: { core } });
  refresh();
  return { ok: true };
}

const textSchema = z.string().trim().min(1).max(200);

export async function saveAchievement(id: string, _prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = z
    .object({ nameKk: textSchema, nameRu: textSchema, descriptionKk: textSchema, descriptionRu: textSchema })
    .safeParse(Object.fromEntries(["nameKk", "nameRu", "descriptionKk", "descriptionRu"].map((k) => [k, str(fd, k)])));
  if (!parsed.success) return { error: "invalid" };
  await db.achievement.update({ where: { id }, data: parsed.data });
  await audit({ actorId: user.id, action: "catalogue.achievement.update", entity: "Achievement", entityId: id });
  refresh();
  return { ok: true };
}

export async function saveDecoration(id: string, _prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = z
    .object({ nameKk: textSchema, nameRu: textSchema, costMaterials: z.coerce.number().int().min(0).max(1000) })
    .safeParse({ nameKk: str(fd, "nameKk"), nameRu: str(fd, "nameRu"), costMaterials: str(fd, "costMaterials") });
  if (!parsed.success) return { error: "invalid" };
  await db.decoration.update({ where: { id }, data: parsed.data });
  await audit({
    actorId: user.id,
    action: "catalogue.decoration.update",
    entity: "Decoration",
    entityId: id,
    data: { costMaterials: parsed.data.costMaterials },
  });
  refresh();
  return { ok: true };
}

// ---- certificates -----------------------------------------------------------

export async function saveDefaultPolicy(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = z
    .object({
      bronzeMin: z.coerce.number().finite(),
      silverMin: z.coerce.number().finite(),
      goldMin: z.coerce.number().finite(),
      platinumMin: z.coerce.number().finite(),
      minBuildingLevel: z.coerce.number().int(),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "invalid" };
  const error = policyError(parsed.data);
  if (error) return { error };
  const existing = await db.certificatePolicy.findFirst({ where: { classId: null }, select: { id: true } });
  if (existing) await db.certificatePolicy.update({ where: { id: existing.id }, data: parsed.data });
  else await db.certificatePolicy.create({ data: parsed.data });
  await audit({
    actorId: user.id,
    action: "certificate.policy.default",
    entity: "CertificatePolicy",
    data: parsed.data,
  });
  refresh();
  return { ok: true };
}

export async function saveTemplate(id: string, _prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const parsed = z
    .object({ titleKk: z.string().trim().min(3).max(60), titleRu: z.string().trim().min(3).max(60) })
    .safeParse({ titleKk: str(fd, "titleKk"), titleRu: str(fd, "titleRu") });
  if (!parsed.success) return { error: "invalid" };
  await db.certificateTemplate.update({ where: { id }, data: parsed.data });
  await audit({ actorId: user.id, action: "certificate.template.update", entity: "CertificateTemplate", entityId: id });
  refresh();
  return { ok: true };
}

/** The verify page then says "revoked", and nothing is re-issued automatically. */
export async function revokeCertificate(id: string): Promise<AdminResult> {
  const user = await admin();
  await db.certificate.updateMany({
    where: { id, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: "REVOKED" },
  });
  await audit({ actorId: user.id, action: "certificate.revoke", entity: "Certificate", entityId: id });
  refresh();
  return { ok: true };
}

export async function reinstateCertificate(id: string): Promise<AdminResult> {
  const user = await admin();
  const cert = await db.certificate.findUnique({ where: { id }, select: { studentId: true, revokedReason: true } });
  if (cert?.revokedReason !== "REVOKED") return { error: "invalid" };
  const active = await db.certificate.count({ where: { studentId: cert.studentId, revokedAt: null } });
  if (active > 0) return { error: "hasActive" };
  await db.certificate.update({ where: { id }, data: { revokedAt: null, revokedReason: null } });
  await audit({ actorId: user.id, action: "certificate.reinstate", entity: "Certificate", entityId: id });
  refresh();
  return { ok: true };
}

// ---- settings ---------------------------------------------------------------

export async function saveSettingsAction(_prev: AdminResult, fd: FormData): Promise<AdminResult> {
  const user = await admin();
  const values = {
    "registration.studentsByInviteCode": SETTING_SCHEMAS["registration.studentsByInviteCode"].safeParse(
      fd.get("registration") === "on",
    ),
    "scoring.defaultMode": SETTING_SCHEMAS["scoring.defaultMode"].safeParse(str(fd, "defaultMode")),
    "auth.maxLoginFailures": SETTING_SCHEMAS["auth.maxLoginFailures"].safeParse(Number(str(fd, "maxLoginFailures"))),
  };
  if (Object.values(values).some((v) => !v.success)) return { error: "invalid" };
  const data = {
    "registration.studentsByInviteCode": values["registration.studentsByInviteCode"].data!,
    "scoring.defaultMode": values["scoring.defaultMode"].data!,
    "auth.maxLoginFailures": values["auth.maxLoginFailures"].data!,
  };
  await saveSettings(data);
  await audit({ actorId: user.id, action: "settings.update", entity: "PlatformSetting", data });
  refresh();
  return { ok: true };
}

// ---- backups ----------------------------------------------------------------

export async function createBackupAction(): Promise<AdminResult> {
  const user = await admin();
  if (!backupsSupported()) return { error: "remoteBackups" };
  const file = await createBackup();
  await audit({ actorId: user.id, action: "backup.create", entity: "Backup", entityId: file.name });
  refresh();
  return { ok: true };
}

export async function deleteBackupAction(name: string): Promise<AdminResult> {
  const user = await admin();
  if (await deleteBackup(name)) {
    await audit({ actorId: user.id, action: "backup.delete", entity: "Backup", entityId: name });
  }
  refresh();
  return { ok: true };
}
