import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { cityCompletion } from "@/lib/domain/levels";
import { assertTeachesClass } from "./access";

/** Weeks shown in the progress chart. */
export const WEEKS = 8;
/** A student needs attention below this average, or after this many days without submitting. */
export const ATTENTION_AVERAGE = 5;
export const ATTENTION_IDLE_DAYS = 7;

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => (xs.length ? round1(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Monday 00:00 (Asia/Almaty, UTC+5) of the week containing `d`, as a UTC timestamp. */
export function weekStart(d: Date): number {
  const OFFSET = 5 * 3600_000;
  const local = new Date(d.getTime() + OFFSET);
  const day = (local.getUTCDay() + 6) % 7; // Monday = 0
  local.setUTCHours(0, 0, 0, 0);
  return local.getTime() - day * 86_400_000 - OFFSET;
}

/**
 * Class analytics (spec §9 for the teacher): number of tasks, average score,
 * results by topic, number of attempts, a progress chart, buildings built and
 * works waiting for review — plus per-student and per-task tables.
 */
export async function getClassAnalytics(user: SessionUser, classId: string, now = new Date()) {
  await assertTeachesClass(user, classId);
  const klass = await db.schoolClass.findUnique({
    where: { id: classId },
    select: {
      id: true,
      name: true,
      members: {
        select: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              city: { select: { buildings: { select: { level: true, building: { select: { key: true } } } } } },
            },
          },
        },
      },
    },
  });
  if (!klass) return null;

  const students = klass.members.map((m) => m.student);
  const studentIds = students.map((s) => s.id);
  const tasks = await db.task.findMany({
    where: {
      status: "PUBLISHED",
      assignments: { some: { OR: [{ classId }, { studentId: { in: studentIds } }] } },
    },
    select: {
      id: true,
      title: true,
      building: { select: { key: true } },
      topic: { select: { id: true, title: true } },
    },
  });
  const taskIds = tasks.map((t) => t.id);
  const attempts = await db.attempt.findMany({
    where: { studentId: { in: studentIds }, taskId: { in: taskIds }, status: { not: "IN_PROGRESS" } },
    select: { studentId: true, taskId: true, status: true, score: true, submittedAt: true },
  });
  const graded = attempts.filter((a) => a.status === "GRADED" && a.score != null);
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  // ---- headline numbers ------------------------------------------------------
  const completions = students.map((s) => cityCompletion(s.city?.buildings.map((b) => b.level) ?? []));
  const summary = {
    students: students.length,
    tasks: tasks.length,
    average: mean(graded.map((a) => a.score!)),
    attempts: attempts.length,
    buildingsBuilt: students.reduce((n, s) => n + (s.city?.buildings.filter((b) => b.level >= 1).length ?? 0), 0),
    pending: attempts.filter((a) => a.status === "PENDING_REVIEW").length,
    completion: completions.length ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length) : 0,
  };

  // ---- results by topic -------------------------------------------------------
  const topicMap = new Map<string, { title: string; scores: number[]; students: Set<string> }>();
  for (const a of graded) {
    const t = taskById.get(a.taskId)!;
    const key = t.topic?.id ?? `task:${t.id}`;
    const entry = topicMap.get(key) ?? { title: t.topic?.title ?? t.title, scores: [], students: new Set() };
    entry.scores.push(a.score!);
    entry.students.add(a.studentId);
    topicMap.set(key, entry);
  }
  const byTopic = [...topicMap.values()]
    .map((e) => ({ title: e.title, average: mean(e.scores)!, attempts: e.scores.length, students: e.students.size }))
    .sort((a, b) => a.average - b.average);

  // ---- weekly progress (last WEEKS weeks, oldest first) -----------------------
  const thisWeek = weekStart(now);
  const weeks = Array.from({ length: WEEKS }, (_, i) => thisWeek - (WEEKS - 1 - i) * 7 * 86_400_000);
  const weekly = weeks.map((start) => {
    const inWeek = attempts.filter((a) => a.submittedAt && weekStart(a.submittedAt) === start);
    return {
      start: new Date(start),
      average: mean(inWeek.filter((a) => a.status === "GRADED" && a.score != null).map((a) => a.score!)),
      attempts: inWeek.length,
    };
  });

  // ---- buildings: average level across the class -----------------------------
  const byBuilding = BUILDINGS.map((b) => {
    const levels = students.map((s) => s.city?.buildings.find((x) => x.building.key === b.key)?.level ?? 0);
    return {
      key: b.key as BuildingKey,
      averageLevel: levels.length ? round1(levels.reduce((a, c) => a + c, 0) / levels.length) : 0,
      built: levels.filter((l) => l >= 1).length,
    };
  });

  // ---- students ---------------------------------------------------------------
  const idleSince = now.getTime() - ATTENTION_IDLE_DAYS * 86_400_000;
  const studentRows = students
    .map((s, i) => {
      const mine = attempts.filter((a) => a.studentId === s.id);
      const scores = mine.filter((a) => a.status === "GRADED" && a.score != null).map((a) => a.score!);
      const last = mine.reduce<Date | null>(
        (d, a) => (a.submittedAt && (!d || a.submittedAt > d) ? a.submittedAt : d),
        null,
      );
      const average = mean(scores);
      const flags: ("low" | "idle")[] = [];
      if (average != null && average < ATTENTION_AVERAGE) flags.push("low");
      if (!last || last.getTime() < idleSince) flags.push("idle");
      return {
        id: s.id,
        name: `${s.lastName} ${s.firstName}`,
        completion: completions[i],
        average,
        attempts: mine.length,
        tasksDone: new Set(mine.filter((a) => a.status === "GRADED").map((a) => a.taskId)).size,
        lastActive: last,
        flags,
      };
    })
    .sort((a, b) => b.flags.length - a.flags.length || a.name.localeCompare(b.name));

  // ---- tasks ------------------------------------------------------------------
  const taskRows = tasks
    .map((t) => {
      const mine = attempts.filter((a) => a.taskId === t.id);
      return {
        id: t.id,
        title: t.title,
        building: t.building.key as BuildingKey,
        attempts: mine.length,
        studentsDone: new Set(mine.filter((a) => a.status === "GRADED").map((a) => a.studentId)).size,
        average: mean(mine.filter((a) => a.status === "GRADED" && a.score != null).map((a) => a.score!)),
        pending: mine.filter((a) => a.status === "PENDING_REVIEW").length,
      };
    })
    .sort((a, b) => (a.average ?? 11) - (b.average ?? 11));

  return {
    klass: { id: klass.id, name: klass.name },
    summary,
    byTopic,
    weekly,
    byBuilding,
    students: studentRows,
    tasks: taskRows,
  };
}

export type ClassAnalytics = NonNullable<Awaited<ReturnType<typeof getClassAnalytics>>>;
