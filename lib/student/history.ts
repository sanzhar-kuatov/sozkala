import "server-only";
import { assertCanViewStudent } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { BuildingKey } from "@/lib/domain/buildings";

/** Personal progress (spec §9 "for the student: personal progress"; parents see the same for their child). */
export async function getLearningHistory(viewer: SessionUser, studentId: string) {
  await assertCanViewStudent(viewer, studentId);
  const [attempts, events] = await Promise.all([
    db.attempt.findMany({
      where: { studentId, status: { not: "IN_PROGRESS" } },
      orderBy: { submittedAt: "asc" },
      select: {
        id: true,
        taskId: true,
        number: true,
        status: true,
        score: true,
        submittedAt: true,
        task: { select: { title: true, building: { select: { key: true } } } },
      },
    }),
    db.buildingLevelEvent.findMany({
      where: { progress: { city: { studentId } } },
      orderBy: { createdAt: "asc" },
      select: {
        fromLevel: true,
        toLevel: true,
        createdAt: true,
        attemptId: true,
        progress: { select: { building: { select: { key: true } } } },
      },
    }),
  ]);

  const graded = attempts.filter((a) => a.status === "GRADED" && a.score != null);
  const scores = graded.map((a) => a.score!);
  const levelUpBy = new Map(events.filter((e) => e.attemptId).map((e) => [e.attemptId!, e]));

  return {
    summary: {
      average: scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null,
      best: scores.length ? Math.max(...scores) : null,
      tasksDone: new Set(graded.map((a) => a.taskId)).size,
      attempts: attempts.length,
      levelUps: events.length,
    },
    /** Graded results in time order — the progress line. */
    series: graded.map((a) => ({ at: a.submittedAt!, score: a.score!, title: a.task.title })),
    /** Newest first, for the timeline. */
    timeline: [...attempts].reverse().map((a) => {
      const ev = levelUpBy.get(a.id);
      return {
        id: a.id,
        taskId: a.taskId,
        title: a.task.title,
        number: a.number,
        status: a.status,
        score: a.score,
        at: a.submittedAt,
        building: a.task.building.key as BuildingKey,
        levelUp: ev ? { from: ev.fromLevel, to: ev.toLevel } : null,
      };
    }),
  };
}

export type LearningHistory = Awaited<ReturnType<typeof getLearningHistory>>;
