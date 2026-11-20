import "server-only";
import type { GradingMode, TaskType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { BuildingKey } from "@/lib/domain/buildings";
import { gradeTask } from "@/lib/grading/grade";
import { applyGradedAttempt } from "@/lib/grading/progress";
import { notify, teachersOf } from "@/lib/notifications";
import { answersJson, sanitizeAnswers, type Answers } from "@/lib/tasks/answers";
import type { TaskTypeValue } from "@/lib/tasks/schemas";
import { assignedTaskIds, getCityView } from "./city";

/** Extra time after the limit before the server stops accepting answers (network delays). */
export const TIME_GRACE_MS = 30_000;

export type BlockReason = "locked" | "deadline" | "pending" | "noAttempts";

export type QuestionContent = { id: string; prompt: string } & Record<string, unknown>;
export type TaskContent = { passage?: string; source?: string; questions: QuestionContent[] };

export type StudentTask = {
  id: string;
  title: string;
  instruction: string;
  type: TaskType;
  grading: GradingMode;
  content: TaskContent;
  criteria: { id: string; title: string; max: number }[] | null;
  explanation: string | null;
  timeLimitSec: number | null;
  buildingKey: BuildingKey;
  required: boolean;
  deadline: Date | null;
  /** null = unlimited */
  maxAttempts: number | null;
  attemptsUsed: number;
  inProgress: { id: string; answers: Answers; startedAt: Date; endsAt: Date | null } | null;
  blocked: BlockReason | null;
  materials: TaskMaterial[];
};

export type TaskMaterial = {
  id: string;
  kind: "TEXT" | "IMAGE" | "AUDIO" | "VIDEO";
  title: string;
  body: string | null;
  filePath: string | null;
};

/** Attempts that count against the limit (a teacher's "return for redo" does not). */
const COUNTED = ["GRADED", "PENDING_REVIEW"] as const;

/**
 * A task as the student may see it — WITHOUT the answer key. Returns null when
 * the task is not assigned to this student or not published. An in-progress
 * attempt whose time ran out is submitted here automatically.
 */
export async function getStudentTask(user: SessionUser, taskId: string): Promise<StudentTask | null> {
  const { assignments } = await assignedTaskIds(user.id);
  const assignment = assignments.find((a) => a.taskId === taskId);
  if (!assignment) return null;

  const task = await db.task.findFirst({
    where: { id: taskId, status: "PUBLISHED" },
    select: {
      id: true,
      title: true,
      instruction: true,
      type: true,
      grading: true,
      content: true,
      criteria: true,
      explanation: true,
      timeLimitSec: true,
      maxAttempts: true,
      building: { select: { key: true } },
      materials: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, title: true, body: true, filePath: true },
      },
    },
  });
  if (!task) return null;

  let inProgress = await db.attempt.findFirst({
    where: { taskId, studentId: user.id, status: "IN_PROGRESS" },
    select: { id: true, answers: true, startedAt: true },
  });
  if (inProgress && task.timeLimitSec && isExpired(inProgress.startedAt, task.timeLimitSec)) {
    await finalizeAttempt(inProgress.id);
    inProgress = null;
  }

  const [used, extra, last, city] = await Promise.all([
    db.attempt.count({ where: { taskId, studentId: user.id, status: { in: [...COUNTED] } } }),
    db.attemptAllowance.aggregate({ where: { taskId, studentId: user.id }, _sum: { extraAttempts: true } }),
    db.attempt.findFirst({
      where: { taskId, studentId: user.id, status: { not: "IN_PROGRESS" } },
      orderBy: { number: "desc" },
      select: { status: true },
    }),
    getCityView(user, user.id),
  ]);

  const maxAttempts = task.maxAttempts == null ? null : task.maxAttempts + (extra._sum.extraAttempts ?? 0);
  const building = city?.buildings.find((b) => b.key === task.building.key);

  let blocked: BlockReason | null = null;
  if (building?.lockedBy) blocked = "locked";
  else if (last?.status === "PENDING_REVIEW") blocked = "pending";
  else if (maxAttempts != null && used >= maxAttempts) blocked = "noAttempts";
  else if (assignment.deadline && assignment.deadline < new Date() && !inProgress) blocked = "deadline";

  return {
    id: task.id,
    title: task.title,
    instruction: task.instruction,
    type: task.type,
    grading: task.grading,
    content: task.content as TaskContent,
    criteria: (task.criteria as StudentTask["criteria"]) ?? null,
    explanation: task.explanation,
    timeLimitSec: task.timeLimitSec,
    buildingKey: task.building.key as BuildingKey,
    required: assignment.isRequired,
    deadline: assignment.deadline,
    maxAttempts,
    attemptsUsed: used,
    inProgress: inProgress && {
      id: inProgress.id,
      answers: (inProgress.answers ?? {}) as Answers,
      startedAt: inProgress.startedAt,
      endsAt: task.timeLimitSec ? new Date(inProgress.startedAt.getTime() + task.timeLimitSec * 1000) : null,
    },
    blocked,
    materials: task.materials,
  };
}

export function isExpired(startedAt: Date, timeLimitSec: number, graceMs = TIME_GRACE_MS) {
  return Date.now() > startedAt.getTime() + timeLimitSec * 1000 + graceMs;
}

/** Starts a new attempt (or returns the one already in progress). */
export async function startAttempt(
  user: SessionUser,
  taskId: string,
): Promise<{ id: string } | { error: BlockReason | "notFound" }> {
  const task = await getStudentTask(user, taskId);
  if (!task) return { error: "notFound" };
  if (task.inProgress) return { id: task.inProgress.id };
  if (task.blocked) return { error: task.blocked };

  const last = await db.attempt.findFirst({
    where: { taskId, studentId: user.id },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const attempt = await db.attempt.create({
    data: { taskId, studentId: user.id, number: (last?.number ?? 0) + 1, status: "IN_PROGRESS", answers: {} },
    select: { id: true },
  });
  return attempt;
}

/** The student's own in-progress attempt, or null. */
export async function ownInProgressAttempt(user: SessionUser, attemptId: string) {
  return db.attempt.findFirst({
    where: { id: attemptId, studentId: user.id, status: "IN_PROGRESS" },
    select: {
      id: true,
      startedAt: true,
      task: { select: { id: true, type: true, content: true, timeLimitSec: true } },
    },
  });
}

export function cleanAnswers(type: TaskType, content: unknown, raw: unknown): Answers {
  const ids = ((content as TaskContent).questions ?? []).map((q) => q.id);
  return sanitizeAnswers(type as TaskTypeValue, ids, raw);
}

/**
 * Closes an attempt: auto-graded tasks get their score now (status GRADED);
 * essays, creative work and audio go to the teacher (PENDING_REVIEW).
 * Graded attempts then grow the building (lib/grading/progress.ts).
 */
export async function finalizeAttempt(attemptId: string, answers?: Answers) {
  const attempt = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    select: {
      id: true,
      status: true,
      answers: true,
      studentId: true,
      taskId: true,
      task: { select: { type: true, grading: true, content: true, answerKey: true } },
    },
  });
  if (attempt.status !== "IN_PROGRESS") return attempt.id;

  const finalAnswers = answers ?? ((attempt.answers ?? {}) as Answers);
  const now = new Date();

  if (attempt.task.grading === "MANUAL") {
    const { count } = await db.attempt.updateMany({
      where: { id: attempt.id, status: "IN_PROGRESS" },
      data: { status: "PENDING_REVIEW", answers: answersJson(finalAnswers), submittedAt: now },
    });
    if (count === 1) {
      await notify(
        db,
        await teachersOf(db, attempt.studentId),
        "REVIEW_NEEDED",
        { attemptId: attempt.id, taskId: attempt.taskId },
        attempt.studentId,
      );
    }
    return attempt.id;
  }

  const { score, results } = gradeTask(
    attempt.task.type as TaskTypeValue,
    attempt.task.content as TaskContent,
    (attempt.task.answerKey ?? {}) as Record<string, Record<string, unknown>>,
    finalAnswers,
  );
  // updateMany with the status condition makes double submits harmless.
  const { count } = await db.attempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: {
      status: "GRADED",
      answers: answersJson(finalAnswers),
      result: results,
      autoScore: score,
      score,
      submittedAt: now,
      gradedAt: now,
    },
  });
  // Only the request that actually closed the attempt grows the building.
  if (count === 1) await applyGradedAttempt(attempt.id);
  return attempt.id;
}
