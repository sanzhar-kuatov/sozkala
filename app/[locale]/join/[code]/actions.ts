"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import { createSession, requestMeta } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { PRIVACY_VERSION } from "@/lib/privacy";
import { getSetting } from "@/lib/settings";
import { CITY_NAME_MAX, createCityForStudent } from "@/lib/domain/city";

export type JoinField = "firstName" | "lastName" | "login" | "password" | "confirm" | "cityName";
export type JoinErrorKey = "required" | "tooLong" | "loginFormat" | "loginTaken" | "passwordShort" | "mismatch";
export type JoinState =
  | {
      errors?: Partial<Record<JoinField, JoinErrorKey>>;
      formError?: "invalidCode" | "consent" | "tooMany";
      values?: Partial<Record<JoinField, string>>;
    }
  | undefined;

const name = z.string().trim().min(1, "required").max(50, "tooLong");

const registerSchema = z
  .object({
    firstName: name,
    lastName: name,
    login: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9._-]{3,32}$/, "loginFormat"),
    password: z.string().min(MIN_PASSWORD_LENGTH, "passwordShort").max(200, "tooLong"),
    confirm: z.string(),
    cityName: z.string().trim().max(CITY_NAME_MAX, "tooLong"),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "mismatch" });

/** null when the code is unknown/archived or the admin closed invite-code registration. */
async function findClass(code: string) {
  if (!(await getSetting("registration.studentsByInviteCode"))) return null;
  return db.schoolClass.findFirst({
    where: { inviteCode: code.toUpperCase(), archivedAt: null },
    select: { id: true, schoolId: true },
  });
}

/** New student: account + empty city + class membership, then signed in (spec §2.1, §13). */
export async function registerStudent(code: string, _prev: JoinState, formData: FormData): Promise<JoinState> {
  const raw = Object.fromEntries(
    (["firstName", "lastName", "login", "password", "confirm", "cityName"] as const).map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  ) as Record<JoinField, string>;
  const values = { firstName: raw.firstName, lastName: raw.lastName, login: raw.login, cityName: raw.cityName };

  const klass = await findClass(code);
  if (!klass) return { formError: "invalidCode", values };

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: Partial<Record<JoinField, JoinErrorKey>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as JoinField;
      errors[field] ??= (issue.message as JoinErrorKey) ?? "required";
    }
    return { errors, values };
  }
  const v = parsed.data;
  // Personal data law of the RK: processing needs consent (a legal representative's for minors).
  if (formData.get("consent") !== "on") return { formError: "consent", values };
  // At most 20 registrations per IP address per hour (a classroom fits; a script does not).
  const { ip } = await requestMeta();
  if (
    ip &&
    (await db.auditLog.count({
      where: { action: "auth.register", ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    })) >= 20
  ) {
    return { formError: "tooMany", values };
  }

  if (await db.user.findUnique({ where: { login: v.login }, select: { id: true } })) {
    return { errors: { login: "loginTaken" }, values };
  }

  const passwordHash = await hashPassword(v.password);
  const locale = await getLocale();
  const cityName = v.cityName || (locale === "ru" ? `${v.firstName}град` : `${v.firstName}-қала`);

  let user: { id: string; role: "STUDENT" };
  try {
    user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          login: v.login,
          passwordHash,
          role: "STUDENT",
          firstName: v.firstName,
          lastName: v.lastName,
          locale: locale === "ru" ? "ru" : "kk",
          schoolId: klass.schoolId,
        },
      });
      await createCityForStudent(tx, created.id, cityName);
      await tx.classMember.create({ data: { classId: klass.id, studentId: created.id } });
      return { id: created.id, role: "STUDENT" as const };
    });
  } catch (error) {
    // Two people registering the same login at the same moment → unique constraint.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { errors: { login: "loginTaken" }, values };
    }
    throw error;
  }

  await audit({
    actorId: user.id,
    action: "auth.register",
    entity: "User",
    entityId: user.id,
    data: { classId: klass.id, consent: PRIVACY_VERSION },
  });
  await createSession(user);
  redirect({ href: "/student", locale });
}

/** A signed-in student joins another class with a code. */
export async function joinAsCurrentStudent(code: string) {
  const user = await authorize(["STUDENT"], { write: true });
  const klass = await findClass(code);
  if (!klass) throw new Error("invalid invite code");
  await db.classMember.upsert({
    where: { classId_studentId: { classId: klass.id, studentId: user.id } },
    update: {},
    create: { classId: klass.id, studentId: user.id },
  });
  await audit({ actorId: user.id, action: "class.join", entity: "SchoolClass", entityId: klass.id });
  redirect({ href: "/student", locale: await getLocale() });
}
