import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { cityCompletion } from "@/lib/domain/levels";
import { assertTeachesClass } from "./access";

/** The teacher's classes with student counts (admin: all classes). */
export async function listClasses(user: SessionUser) {
  return db.schoolClass.findMany({
    where: user.role === "ADMIN" ? {} : { teacherId: user.id },
    orderBy: [{ archivedAt: "asc" }, { grade: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      grade: true,
      academicYear: true,
      inviteCode: true,
      archivedAt: true,
      _count: { select: { members: true } },
    },
  });
}

export type ClassStudent = {
  id: string;
  firstName: string;
  lastName: string;
  login: string;
  completion: number;
  average: number | null;
  attempts: number;
  lastActive: Date | null;
  parents: { id: string; name: string; login: string }[];
};

/** One class with its students' progress (spec §2.2 "add class and students"). */
export async function getClassDetail(user: SessionUser, classId: string) {
  await assertTeachesClass(user, classId);
  const klass = await db.schoolClass.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      grade: true,
      academicYear: true,
      inviteCode: true,
      archivedAt: true,
      school: { select: { name: true } },
      members: {
        orderBy: { student: { lastName: "asc" } },
        select: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              login: true,
              lastLoginAt: true,
              city: { select: { buildings: { select: { level: true } } } },
              attempts: {
                where: { status: "GRADED" },
                select: { score: true, gradedAt: true },
              },
              parentLinks: {
                select: { parent: { select: { id: true, firstName: true, lastName: true, login: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (!klass) return null;

  const students: ClassStudent[] = klass.members.map(({ student: s }) => {
    const scores = s.attempts.map((a) => a.score!).filter((x) => x != null);
    const lastGraded = s.attempts.reduce<Date | null>(
      (d, a) => (a.gradedAt && (!d || a.gradedAt > d) ? a.gradedAt : d),
      null,
    );
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      login: s.login,
      completion: cityCompletion(s.city?.buildings.map((b) => b.level) ?? []),
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      attempts: scores.length,
      lastActive: [s.lastLoginAt, lastGraded].reduce<Date | null>((d, x) => (x && (!d || x > d) ? x : d), null),
      parents: s.parentLinks.map((l) => ({
        id: l.parent.id,
        name: `${l.parent.firstName} ${l.parent.lastName}`,
        login: l.parent.login,
      })),
    };
  });

  return { ...klass, students };
}
