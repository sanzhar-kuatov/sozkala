"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { applyGradedAttempt } from "@/lib/grading/progress";
import { notify } from "@/lib/notifications";
import { criteriaSchema } from "@/lib/tasks/schemas";
import { getReviewAttempt } from "@/lib/teacher/review";

export type ReviewState = { error?: "invalid" | "gone" } | undefined;

const feedbackSchema = z.string().trim().max(2000);

/** "Grade ✓": rubric points → score 0–10 → building progression (acceptance test #8). */
export async function gradeAttempt(attemptId: string, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  const attempt = await getReviewAttempt(user, attemptId);
  if (!attempt || attempt.status !== "PENDING_REVIEW") return { error: "gone" };

  const criteria = criteriaSchema.safeParse(attempt.task.criteria);
  if (!criteria.success) return { error: "invalid" };

  const rubric: Record<string, number> = {};
  for (const c of criteria.data) {
    const points = Number(formData.get(`c_${c.id}`));
    if (!Number.isFinite(points) || points < 0 || points > c.max) return { error: "invalid" };
    rubric[c.id] = Math.round(points * 2) / 2; // half points allowed
  }
  const score = Math.min(
    10,
    Object.values(rubric).reduce((s, p) => s + p, 0),
  );
  const feedback = feedbackSchema.parse(String(formData.get("feedback") ?? "")) || null;

  const { count } = await db.attempt.updateMany({
    where: { id: attempt.id, status: "PENDING_REVIEW" },
    data: {
      status: "GRADED",
      rubric,
      manualScore: score,
      score,
      feedback,
      gradedAt: new Date(),
      gradedById: user.id,
    },
  });
  if (count !== 1) return { error: "gone" }; // someone else graded it meanwhile

  await applyGradedAttempt(attempt.id);
  await notify(db, [attempt.studentId], "WORK_GRADED", { attemptId: attempt.id, taskId: attempt.task.id, score });
  await audit({
    actorId: user.id,
    action: "attempt.grade",
    entity: "Attempt",
    entityId: attempt.id,
    data: { score, rubric },
  });

  redirect({ href: "/teacher/review", locale: await getLocale() });
}

/** "Return for redo": does not count as an attempt; the student can submit again. */
export async function returnAttempt(attemptId: string, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  const attempt = await getReviewAttempt(user, attemptId);
  if (!attempt || attempt.status !== "PENDING_REVIEW") return { error: "gone" };
  const feedback = feedbackSchema.parse(String(formData.get("feedback") ?? "")) || null;

  const { count } = await db.attempt.updateMany({
    where: { id: attempt.id, status: "PENDING_REVIEW" },
    data: { status: "RETURNED", feedback, gradedAt: new Date(), gradedById: user.id },
  });
  if (count !== 1) return { error: "gone" };

  await notify(db, [attempt.studentId], "WORK_RETURNED", { attemptId: attempt.id, taskId: attempt.task.id });
  await audit({ actorId: user.id, action: "attempt.return", entity: "Attempt", entityId: attempt.id });

  redirect({ href: "/teacher/review", locale: await getLocale() });
}
