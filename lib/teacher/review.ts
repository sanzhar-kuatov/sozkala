import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { viewableStudentIds } from "@/lib/auth/guards";
import { db } from "@/lib/db";

/**
 * Which pending works a reviewer may see: an admin sees all; a teacher sees work
 * of students in their classes, on tasks they authored or assigned to their classes.
 */
async function reviewScope(user: SessionUser) {
  if (user.role === "ADMIN") return {};
  const students = await viewableStudentIds(user);
  return {
    studentId: { in: students === "all" ? undefined : students },
    task: {
      OR: [{ authorId: user.id }, { assignments: { some: { class: { teacherId: user.id } } } }],
    },
  };
}

/** Manual review queue (spec §2.2 "grade essays and creative work manually"). */
export async function getReviewQueue(user: SessionUser) {
  const scope = await reviewScope(user);
  return db.attempt.findMany({
    where: { status: "PENDING_REVIEW", ...scope },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      number: true,
      submittedAt: true,
      student: {
        select: {
          firstName: true,
          lastName: true,
          memberships: { select: { class: { select: { name: true } } }, take: 1 },
        },
      },
      task: { select: { title: true, type: true, building: { select: { key: true } } } },
    },
  });
}

/** Recently reviewed works (for the queue page). */
export async function getRecentlyReviewed(user: SessionUser, take = 8) {
  const scope = await reviewScope(user);
  return db.attempt.findMany({
    where: { status: { in: ["GRADED", "RETURNED"] }, gradedById: { not: null }, ...scope },
    orderBy: { gradedAt: "desc" },
    take,
    select: {
      id: true,
      status: true,
      score: true,
      gradedAt: true,
      student: { select: { firstName: true, lastName: true } },
      task: { select: { title: true } },
    },
  });
}

/** One attempt for the review screen, or null when the reviewer may not see it. */
export async function getReviewAttempt(user: SessionUser, attemptId: string) {
  const scope = await reviewScope(user);
  return db.attempt.findFirst({
    where: { id: attemptId, ...scope },
    select: {
      id: true,
      number: true,
      status: true,
      answers: true,
      rubric: true,
      score: true,
      feedback: true,
      submittedAt: true,
      studentId: true,
      student: { select: { firstName: true, lastName: true, city: { select: { id: true } } } },
      task: {
        select: {
          id: true,
          title: true,
          instruction: true,
          type: true,
          grading: true,
          content: true,
          criteria: true,
          buildingTypeId: true,
          building: { select: { key: true } },
        },
      },
    },
  });
}
