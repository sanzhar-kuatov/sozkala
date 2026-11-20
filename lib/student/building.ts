import "server-only";
import type { AttemptStatus, GradingMode, TaskType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { BuildingKey } from "@/lib/domain/buildings";
import { assignedTaskIds, getCityView, type BuildingState } from "./city";

export type TaskRow = {
  id: string;
  title: string;
  type: TaskType;
  grading: GradingMode;
  difficulty: number;
  required: boolean;
  deadline: Date | null;
  maxAttempts: number | null;
  attemptsUsed: number;
  bestScore: number | null;
  status: "new" | "done" | "pending" | "returned";
  /** latest submitted attempt (for the "result" link) */
  lastAttemptId: string | null;
  /** an unfinished attempt exists → "continue" */
  inProgress: boolean;
};

export type BuildingDetail = {
  state: BuildingState;
  history: { from: number; to: number; score: number; at: Date }[];
  tasks: TaskRow[];
};

/** One building of one student: state, level history and its assigned tasks. */
export async function getBuildingDetail(
  viewer: SessionUser,
  studentId: string,
  key: BuildingKey,
): Promise<BuildingDetail | null> {
  const city = await getCityView(viewer, studentId); // also checks access
  const state = city?.buildings.find((b) => b.key === key);
  if (!city || !state) return null;

  const progress = await db.buildingProgress.findFirst({
    where: { cityId: city.city.id, building: { key } },
    select: {
      events: {
        orderBy: { createdAt: "asc" },
        select: { fromLevel: true, toLevel: true, score: true, createdAt: true },
      },
    },
  });

  const { assignments } = await assignedTaskIds(studentId);
  const byTask = new Map(assignments.map((a) => [a.taskId, a]));
  const tasks = await db.task.findMany({
    where: { id: { in: [...byTask.keys()] }, building: { key } },
    orderBy: [{ createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      type: true,
      grading: true,
      difficulty: true,
      maxAttempts: true,
      _count: { select: { attempts: { where: { studentId, status: "IN_PROGRESS" } } } },
      attempts: {
        where: { studentId, status: { not: "IN_PROGRESS" } },
        orderBy: { number: "asc" },
        select: { id: true, status: true, score: true },
      },
    },
  });

  const statusOf = (attempts: { status: AttemptStatus; score: number | null }[]): TaskRow["status"] => {
    if (attempts.some((a) => a.status === "GRADED")) return "done";
    const last = attempts.at(-1);
    if (last?.status === "PENDING_REVIEW") return "pending";
    if (last?.status === "RETURNED") return "returned";
    return "new";
  };

  return {
    state,
    history: (progress?.events ?? []).map((e) => ({
      from: e.fromLevel,
      to: e.toLevel,
      score: e.score,
      at: e.createdAt,
    })),
    tasks: tasks
      .map((t) => {
        const graded = t.attempts.filter((a) => a.status === "GRADED" && a.score != null).map((a) => a.score!);
        return {
          id: t.id,
          title: t.title,
          type: t.type,
          grading: t.grading,
          difficulty: t.difficulty,
          required: byTask.get(t.id)?.isRequired ?? true,
          deadline: byTask.get(t.id)?.deadline ?? null,
          maxAttempts: t.maxAttempts,
          attemptsUsed: t.attempts.filter((a) => a.status === "GRADED" || a.status === "PENDING_REVIEW").length,
          bestScore: graded.length ? Math.max(...graded) : null,
          status: statusOf(t.attempts),
          lastAttemptId: t.attempts.at(-1)?.id ?? null,
          inProgress: t._count.attempts > 0,
        };
      })
      // required first, then optional
      .sort((a, b) => Number(b.required) - Number(a.required)),
  };
}
