import "server-only";
import type { TaskStatus, TaskType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isBuildingKey } from "@/lib/domain/buildings";
import { assertOwnsTask } from "./access";

const ownTasks = (user: SessionUser) => (user.role === "ADMIN" ? {} : { authorId: user.id });

/** Task bank with filters (spec §2.2 "manage tasks"). */
export async function listTasks(
  user: SessionUser,
  filter: { building?: string; status?: string; q?: string; grade?: number },
) {
  return db.task.findMany({
    where: {
      ...ownTasks(user),
      ...(filter.building && isBuildingKey(filter.building) ? { building: { key: filter.building } } : {}),
      ...(filter.status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(filter.status)
        ? { status: filter.status as TaskStatus }
        : { status: { not: "ARCHIVED" } }),
      ...(filter.q ? { title: { contains: filter.q } } : {}),
      ...(filter.grade ? { grade: filter.grade } : {}),
    },
    orderBy: [{ grade: "asc" }, { building: { sortOrder: "asc" } }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      grading: true,
      status: true,
      grade: true,
      difficulty: true,
      building: { select: { key: true } },
      topic: { select: { title: true } },
      _count: { select: { assignments: true, attempts: { where: { status: { not: "IN_PROGRESS" } } } } },
    },
  });
}

/** Everything the editor page needs, including the answer key (teacher only). */
export async function getTaskForEditor(user: SessionUser, taskId: string) {
  await assertOwnsTask(user, taskId);
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      title: true,
      instruction: true,
      type: true,
      status: true,
      content: true,
      answerKey: true,
      criteria: true,
      explanation: true,
      grade: true,
      difficulty: true,
      timeLimitSec: true,
      maxAttempts: true,
      topicId: true,
      building: { select: { key: true } },
      materials: {
        orderBy: { createdAt: "asc" },
        select: { id: true, kind: true, title: true, body: true, filePath: true, mimeType: true, sizeBytes: true },
      },
      assignments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          isRequired: true,
          deadline: true,
          class: { select: { id: true, name: true } },
          student: { select: { id: true, firstName: true, lastName: true } },
        },
      },
      _count: { select: { attempts: { where: { status: { not: "IN_PROGRESS" } } } } },
    },
  });
  return task;
}

/** Once students submitted answers, questions and keys are frozen (their results reference them). */
export async function contentLocked(taskId: string) {
  return (await db.attempt.count({ where: { taskId, status: { not: "IN_PROGRESS" } } })) > 0;
}

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>[number];
export type EditorTask = NonNullable<Awaited<ReturnType<typeof getTaskForEditor>>>;
export type { TaskType };
