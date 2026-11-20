"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { deleteAllSessions } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { BUILDINGS } from "@/lib/domain/buildings";
import { createCityForStudent } from "@/lib/domain/city";
import {
  assertTeachesClass,
  assertTeachesStudent,
  newInviteCode,
  suggestLogin,
  temporaryPassword,
} from "@/lib/teacher/access";

const refresh = () => revalidatePath("/[locale]/teacher", "layout");

export type Credentials = { name: string; login: string; password: string };
export type FormResult = { error?: string; created?: Credentials; ok?: boolean } | undefined;

const classSchema = z.object({
  name: z.string().trim().min(1).max(20),
  grade: z.coerce.number().int().min(5).max(11),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/),
});

function currentAcademicYear() {
  const now = new Date();
  const start = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1; // school year starts in September
  return `${start}-${start + 1}`;
}

/** New class + default settings for all 8 buildings. */
export async function createClass(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  const parsed = classSchema.safeParse({
    name: formData.get("name"),
    grade: formData.get("grade"),
    academicYear: formData.get("academicYear") || currentAcademicYear(),
  });
  if (!parsed.success) return { error: "invalid" };

  const teacher = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { schoolId: true } });
  const schoolId =
    teacher.schoolId ?? (await db.school.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }))?.id;
  if (!schoolId) return { error: "noSchool" };

  const buildings = await db.buildingType.findMany({ select: { id: true, key: true } });
  const scoringMode = await getSetting("scoring.defaultMode");
  const klass = await db.schoolClass.create({
    data: {
      ...parsed.data,
      schoolId,
      teacherId: user.id,
      inviteCode: await newInviteCode(),
      buildingConfigs: {
        create: BUILDINGS.map((b, i) => ({
          buildingTypeId: buildings.find((x) => x.key === b.key)!.id,
          unlockOrder: i + 1,
          isRequired: true,
          scoringMode,
        })),
      },
    },
    select: { id: true },
  });
  await audit({
    actorId: user.id,
    action: "class.create",
    entity: "SchoolClass",
    entityId: klass.id,
    data: parsed.data,
  });
  redirect({ href: `/teacher/classes/${klass.id}`, locale: await getLocale() });
}

export async function updateClass(classId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);
  const parsed = classSchema.safeParse({
    name: formData.get("name"),
    grade: formData.get("grade"),
    academicYear: formData.get("academicYear"),
  });
  if (!parsed.success) return { error: "invalid" };
  await db.schoolClass.update({ where: { id: classId }, data: parsed.data });
  await audit({
    actorId: user.id,
    action: "class.update",
    entity: "SchoolClass",
    entityId: classId,
    data: parsed.data,
  });
  refresh();
  return { ok: true };
}

export async function setClassArchived(classId: string, archived: boolean) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);
  await db.schoolClass.update({ where: { id: classId }, data: { archivedAt: archived ? new Date() : null } });
  await audit({
    actorId: user.id,
    action: archived ? "class.archive" : "class.restore",
    entity: "SchoolClass",
    entityId: classId,
  });
  refresh();
}

/** New invite code; the old link stops working. */
export async function regenerateInvite(classId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);
  await db.schoolClass.update({ where: { id: classId }, data: { inviteCode: await newInviteCode() } });
  await audit({ actorId: user.id, action: "class.invite.regenerate", entity: "SchoolClass", entityId: classId });
  refresh();
}

const personSchema = z.object({
  firstName: z.string().trim().min(1).max(50),
  lastName: z.string().trim().min(1).max(50),
});

/** Teacher creates a student account (for pupils without e-mail/phone); credentials are shown once. */
export async function addStudent(classId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);
  const parsed = personSchema.safeParse({ firstName: formData.get("firstName"), lastName: formData.get("lastName") });
  if (!parsed.success) return { error: "invalid" };

  const { firstName, lastName } = parsed.data;
  const login = await suggestLogin(firstName, lastName);
  const password = temporaryPassword();
  const klass = await db.schoolClass.findUniqueOrThrow({ where: { id: classId }, select: { schoolId: true } });

  const student = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        login,
        passwordHash: await hashPassword(password),
        role: "STUDENT",
        firstName,
        lastName,
        schoolId: klass.schoolId,
      },
    });
    await createCityForStudent(tx, created.id, `${firstName}-қала`);
    await tx.classMember.create({ data: { classId, studentId: created.id } });
    return created;
  });
  await audit({ actorId: user.id, action: "student.create", entity: "User", entityId: student.id, data: { classId } });
  refresh();
  return { created: { name: `${firstName} ${lastName}`, login, password } };
}

/** Removes the student from the class (the account and city stay). */
export async function removeStudent(classId: string, studentId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);
  await db.classMember.deleteMany({ where: { classId, studentId } });
  await audit({
    actorId: user.id,
    action: "class.member.remove",
    entity: "SchoolClass",
    entityId: classId,
    data: { studentId },
  });
  refresh();
}

/** New temporary password for a student who forgot theirs; signs them out everywhere. */
export async function resetStudentPassword(studentId: string): Promise<Credentials> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesStudent(user, studentId);
  const password = temporaryPassword();
  const student = await db.user.update({
    where: { id: studentId },
    data: { passwordHash: await hashPassword(password) },
    select: { firstName: true, lastName: true, login: true },
  });
  await deleteAllSessions(studentId);
  await audit({ actorId: user.id, action: "user.password.reset", entity: "User", entityId: studentId });
  return { name: `${student.firstName} ${student.lastName}`, login: student.login, password };
}

/**
 * Links a parent to a student (spec §2.3: a parent sees only linked children).
 * Either an existing parent account (by login) or a new one (credentials shown once).
 */
export async function linkParent(studentId: string, _prev: FormResult, formData: FormData): Promise<FormResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesStudent(user, studentId);

  const existingLogin = String(formData.get("parentLogin") ?? "")
    .trim()
    .toLowerCase();
  if (existingLogin) {
    const parent = await db.user.findUnique({ where: { login: existingLogin }, select: { id: true, role: true } });
    if (!parent || parent.role !== "PARENT") return { error: "parentNotFound" };
    await db.parentLink.upsert({
      where: { parentId_studentId: { parentId: parent.id, studentId } },
      update: {},
      create: { parentId: parent.id, studentId },
    });
    await audit({
      actorId: user.id,
      action: "parent.link",
      entity: "User",
      entityId: studentId,
      data: { parentId: parent.id },
    });
    refresh();
    return { ok: true };
  }

  const parsed = personSchema.safeParse({ firstName: formData.get("firstName"), lastName: formData.get("lastName") });
  if (!parsed.success) return { error: "invalid" };
  const { firstName, lastName } = parsed.data;
  const login = await suggestLogin(firstName, lastName);
  const password = temporaryPassword();
  const student = await db.user.findUniqueOrThrow({ where: { id: studentId }, select: { schoolId: true } });
  const parent = await db.user.create({
    data: {
      login,
      passwordHash: await hashPassword(password),
      role: "PARENT",
      firstName,
      lastName,
      schoolId: student.schoolId,
      childLinks: { create: { studentId } },
    },
  });
  await audit({ actorId: user.id, action: "parent.create", entity: "User", entityId: parent.id, data: { studentId } });
  refresh();
  return { created: { name: `${firstName} ${lastName}`, login, password } };
}

export async function unlinkParent(studentId: string, parentId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesStudent(user, studentId);
  await db.parentLink.deleteMany({ where: { studentId, parentId } });
  await audit({ actorId: user.id, action: "parent.unlink", entity: "User", entityId: studentId, data: { parentId } });
  refresh();
}
