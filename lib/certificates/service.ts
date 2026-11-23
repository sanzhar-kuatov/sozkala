import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { assertCanViewStudent, AuthError } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { BuildingKey } from "@/lib/domain/buildings";
import { notify, parentsOf } from "@/lib/notifications";
import { assertTeachesClass } from "@/lib/teacher/access";
import {
  DEFAULT_POLICY,
  evaluateEligibility,
  formatSerial,
  type Eligibility,
  type Policy,
  type Tier,
  tierRank,
} from "./rules";

type Tx = Prisma.TransactionClient | typeof db;

/** What the PDF prints, frozen at the moment of issue (Certificate.snapshot). */
export type CertificateSnapshot = {
  name: string;
  className: string | null;
  school: string | null;
  levels: Partial<Record<BuildingKey, number>>;
  titleKk: string;
  titleRu: string;
};

const POLICY_SELECT = {
  bronzeMin: true,
  silverMin: true,
  goldMin: true,
  platinumMin: true,
  minBuildingLevel: true,
} as const;

/** The class's own thresholds, else the platform default row, else the built-in default. */
export async function policyFor(tx: Tx, classId: string | null): Promise<Policy & { own: boolean }> {
  const own = classId ? await tx.certificatePolicy.findUnique({ where: { classId }, select: POLICY_SELECT }) : null;
  if (own) return { ...own, own: true };
  const global = await tx.certificatePolicy.findFirst({ where: { classId: null }, select: POLICY_SELECT });
  return { ...(global ?? DEFAULT_POLICY), own: false };
}

/** Requirements check for one student (no authorization — callers do that). */
async function computeStatus(tx: Tx, studentId: string) {
  const membership = await tx.classMember.findFirst({
    where: { studentId },
    orderBy: { joinedAt: "asc" },
    select: { class: { select: { id: true, name: true, school: { select: { name: true } } } } },
  });
  const klass = membership?.class ?? null;
  const memberships = await tx.classMember.findMany({
    where: { studentId },
    select: { classId: true, class: { select: { grade: true } } },
  });
  const classIds = memberships.map((m) => m.classId);
  const grades = [...new Set(memberships.map((m) => m.class.grade))];

  const [policy, types, configs, progress, assignments, gradedTasks] = await Promise.all([
    policyFor(tx, klass?.id ?? null),
    tx.buildingType.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, key: true, isCore: true } }),
    klass
      ? tx.classBuildingConfig.findMany({
          where: { classId: klass.id },
          select: { buildingTypeId: true, isRequired: true },
        })
      : Promise.resolve([]),
    tx.buildingProgress.findMany({
      where: { city: { studentId } },
      select: { buildingTypeId: true, level: true, score: true },
    }),
    tx.taskAssignment.findMany({
      where: {
        OR: [{ classId: { in: classIds } }, { studentId }],
        task: { status: "PUBLISHED", grade: { in: grades } }, // same rule as lib/student/city.ts
      },
      select: { taskId: true, isRequired: true, task: { select: { title: true } } },
    }),
    tx.attempt.findMany({
      where: { studentId, status: "GRADED" },
      select: { taskId: true },
      distinct: ["taskId"],
    }),
  ]);

  const required = new Map<string, string>();
  for (const a of assignments) if (a.isRequired) required.set(a.taskId, a.task.title);
  const done = new Set(gradedTasks.map((g) => g.taskId));
  const buildings = types.map((t) => {
    const p = progress.find((x) => x.buildingTypeId === t.id);
    return {
      key: t.key,
      // core in the admin catalogue AND required by the class settings
      required: t.isCore && (configs.find((c) => c.buildingTypeId === t.id)?.isRequired ?? true),
      level: p?.level ?? 0,
      score: p?.score ?? null,
    };
  });

  const result = evaluateEligibility({
    requiredTasks: [...required].map(([id, title]) => ({ id, title, done: done.has(id) })),
    buildings,
    policy,
  });
  return { klass, policy, buildings, result };
}

const CERT_SELECT = {
  id: true,
  serial: true,
  verifyCode: true,
  tier: true,
  finalScore: true,
  issuedAt: true,
} as const;

const activeCertificate = (tx: Tx, studentId: string) =>
  tx.certificate.findFirst({
    where: { studentId, revokedAt: null },
    orderBy: { issuedAt: "desc" },
    select: CERT_SELECT,
  });

/**
 * Issues the certificate when the student has just become eligible, or re-issues
 * it when the tier went up (the old one is revoked, so its QR shows "replaced").
 * Called after every graded attempt and when a teacher changes the thresholds.
 */
export async function issueIfEligible(studentId: string, now = new Date()) {
  const status = await computeStatus(db, studentId);
  if (!status.result.eligible) return null;
  const tier = status.result.tier!;

  return db.$transaction(async (tx) => {
    // An admin revoked a certificate: nothing is re-issued automatically (the admin may reinstate it).
    if (await tx.certificate.findFirst({ where: { studentId, revokedReason: "REVOKED" }, select: { id: true } })) {
      return null;
    }
    const active = await activeCertificate(tx, studentId);
    if (active && tierRank(active.tier) >= tierRank(tier)) return null;

    const [student, template, levels] = await Promise.all([
      tx.user.findUniqueOrThrow({ where: { id: studentId }, select: { firstName: true, lastName: true } }),
      tx.certificateTemplate.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, titleKk: true, titleRu: true },
      }),
      Promise.resolve(Object.fromEntries(status.buildings.map((b) => [b.key, b.level]))),
    ]);
    const year = now.getFullYear();
    const issuedThisYear = await tx.certificate.count({ where: { serial: { startsWith: `SZ-${year}-` } } });
    const snapshot: CertificateSnapshot = {
      name: `${student.firstName} ${student.lastName}`,
      className: status.klass?.name ?? null,
      school: status.klass?.school.name ?? null,
      levels,
      titleKk: template?.titleKk ?? "СӨЗҚАЛАНЫҢ БАС СӘУЛЕТШІСІ",
      titleRu: template?.titleRu ?? "ГЛАВНЫЙ АРХИТЕКТОР СЛОВОГРАДА",
    };

    if (active) {
      await tx.certificate.update({ where: { id: active.id }, data: { revokedAt: now, revokedReason: "REPLACED" } });
    }
    const cert = await tx.certificate.create({
      data: {
        serial: formatSerial(year, issuedThisYear + 1),
        verifyCode: randomBytes(12).toString("base64url"), // 16 chars, unguessable
        studentId,
        classId: status.klass?.id ?? null,
        templateId: template?.id ?? null,
        tier,
        finalScore: status.result.finalScore!,
        snapshot,
        issuedAt: now,
      },
      select: CERT_SELECT,
    });

    const payload = { certificateId: cert.id, serial: cert.serial, tier };
    await notify(tx, [studentId], "CERTIFICATE_ISSUED", payload);
    await notify(tx, await parentsOf(tx, studentId), "CERTIFICATE_ISSUED", payload, studentId);
    await tx.auditLog.create({
      data: {
        action: "certificate.issue",
        entity: "Certificate",
        entityId: cert.id,
        data: { serial: cert.serial, tier },
      },
    });
    return cert;
  });
}

export type CertificateInfo = {
  id: string;
  serial: string;
  verifyCode: string;
  tier: Tier;
  finalScore: number;
  issuedAt: Date;
};

export type CertificateView = {
  result: Eligibility;
  policy: Policy;
  certificate: CertificateInfo | null;
};

/** Requirements checklist + the current certificate (student page, parent page). */
export async function getCertificateView(viewer: SessionUser, studentId: string): Promise<CertificateView> {
  await assertCanViewStudent(viewer, studentId);
  const [status, certificate] = await Promise.all([computeStatus(db, studentId), activeCertificate(db, studentId)]);
  return { result: status.result, policy: status.policy, certificate };
}

/** For the PDF download: any viewer of the student (self, linked parent, teacher, admin). */
export async function getCertificateForDownload(viewer: SessionUser, certificateId: string) {
  const cert = await db.certificate.findUnique({
    where: { id: certificateId },
    select: { ...CERT_SELECT, studentId: true, snapshot: true, revokedAt: true },
  });
  if (!cert) throw new AuthError("FORBIDDEN"); // same answer as "not yours" — nothing is revealed
  await assertCanViewStudent(viewer, cert.studentId);
  return { ...cert, snapshot: cert.snapshot as CertificateSnapshot };
}

/** Public verify page (spec §7): validity, serial, tier, date — never the name or school. */
export async function verifyCertificate(code: string) {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(code)) return null;
  const cert = await db.certificate.findUnique({
    where: { verifyCode: code },
    select: { serial: true, tier: true, issuedAt: true, revokedAt: true, revokedReason: true },
  });
  if (!cert) return null;
  const state: "valid" | "replaced" | "revoked" = !cert.revokedAt
    ? "valid"
    : cert.revokedReason === "REPLACED"
      ? "replaced"
      : "revoked";
  return { serial: cert.serial, tier: cert.tier, issuedAt: cert.issuedAt, state };
}

/** Teacher view of one class: thresholds and every student's status. */
export async function getClassCertificates(user: SessionUser, classId: string) {
  await assertTeachesClass(user, classId);
  const [policy, members] = await Promise.all([
    policyFor(db, classId),
    db.classMember.findMany({
      where: { classId },
      select: { student: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
    }),
  ]);
  const students = await Promise.all(
    members.map(async ({ student }) => {
      const [status, certificate] = await Promise.all([
        computeStatus(db, student.id),
        activeCertificate(db, student.id),
      ]);
      return { id: student.id, name: `${student.lastName} ${student.firstName}`, result: status.result, certificate };
    }),
  );
  return { policy, students };
}
