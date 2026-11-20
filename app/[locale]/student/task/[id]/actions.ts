"use server";

import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { answersJson } from "@/lib/tasks/answers";
import {
  cleanAnswers,
  finalizeAttempt,
  isExpired,
  ownInProgressAttempt,
  startAttempt,
  type BlockReason,
} from "@/lib/student/attempts";

/** "Start" / "Retake" button. */
export async function startTask(taskId: string): Promise<{ error: BlockReason | "notFound" } | void> {
  const user = await authorize(["STUDENT"], { write: true });
  const res = await startAttempt(user, taskId);
  if ("error" in res) return res;
  redirect({ href: `/student/task/${taskId}`, locale: await getLocale() });
}

/** Autosave while answering (debounced by the player). */
export async function saveAnswers(attemptId: string, raw: unknown): Promise<{ ok: boolean; expired?: boolean }> {
  const user = await authorize(["STUDENT"], { write: true });
  const attempt = await ownInProgressAttempt(user, attemptId);
  if (!attempt) return { ok: false };
  if (attempt.task.timeLimitSec && isExpired(attempt.startedAt, attempt.task.timeLimitSec)) {
    return { ok: false, expired: true };
  }
  await db.attempt.updateMany({
    where: { id: attempt.id, status: "IN_PROGRESS" },
    data: { answers: answersJson(cleanAnswers(attempt.task.type, attempt.task.content, raw)) },
  });
  return { ok: true };
}

/** "Submit" (or the timer reached zero). Grades closed tasks, sends open ones to the teacher. */
export async function submitAttempt(attemptId: string, raw: unknown) {
  const user = await authorize(["STUDENT"], { write: true });
  const attempt = await ownInProgressAttempt(user, attemptId);
  const locale = await getLocale();

  if (attempt) {
    // Answers sent after the time limit (+ grace) are ignored: the last autosave counts.
    const late = attempt.task.timeLimitSec && isExpired(attempt.startedAt, attempt.task.timeLimitSec);
    await finalizeAttempt(attempt.id, late ? undefined : cleanAnswers(attempt.task.type, attempt.task.content, raw));
    await audit({
      actorId: user.id,
      action: "attempt.submit",
      entity: "Attempt",
      entityId: attempt.id,
      data: { late: !!late },
    });
  }

  const own = await db.attempt.findFirst({ where: { id: attemptId, studentId: user.id }, select: { taskId: true } });
  if (!own) redirect({ href: "/student", locale });
  else redirect({ href: `/student/task/${own.taskId}/result/${attemptId}`, locale });
}
