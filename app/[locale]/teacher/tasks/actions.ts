"use server";

import { getLocale } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { TaskType } from "@/generated/prisma/enums";
import { redirect } from "@/i18n/navigation";
import { audit } from "@/lib/audit";
import { AuthError, authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isBuildingKey } from "@/lib/domain/buildings";
import { DraftInvalid, fromDraft, type DraftError, type TaskDraft } from "@/lib/tasks/authoring";
import { gradingFor, parseTask, type TaskTypeValue } from "@/lib/tasks/schemas";
import { assertOwnsTask, assertTeachesClass, assertTeachesStudent } from "@/lib/teacher/access";
import { contentLocked } from "@/lib/teacher/tasks";

const refresh = () => revalidatePath("/[locale]/teacher", "layout");

const metaSchema = z.object({
  title: z.string().trim().min(1).max(160),
  instruction: z.string().trim().min(1).max(1000),
  type: z.enum(Object.values(TaskType) as [TaskTypeValue, ...TaskTypeValue[]]),
  building: z.string().refine(isBuildingKey),
  topicId: z.string().max(40).optional().nullable(),
  difficulty: z.number().int().min(1).max(3),
  timeLimitMin: z.number().int().min(1).max(240).nullable(),
  maxAttempts: z.number().int().min(1).max(20).nullable(),
  explanation: z.string().trim().max(3000).optional().nullable(),
});

export type SaveTaskInput = { meta: z.input<typeof metaSchema>; draft: TaskDraft; publish: boolean };
export type SaveTaskResult =
  | { ok: true; id: string }
  | { ok: false; error: DraftError | "invalidMeta" | "locked" | "invalid"; question?: number; detail?: string };

/** Create or update a task from the editor (wireframe §4.2 steps 1–4). */
export async function saveTask(taskId: string | null, input: SaveTaskInput): Promise<SaveTaskResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  if (taskId) await assertOwnsTask(user, taskId);

  const meta = metaSchema.safeParse(input.meta);
  if (!meta.success) return { ok: false, error: "invalidMeta" };
  const m = meta.data;

  if (m.topicId) {
    const topic = await db.topic.findFirst({
      where: { id: m.topicId, ...(user.role === "ADMIN" ? {} : { authorId: user.id }) },
    });
    if (!topic) return { ok: false, error: "invalidMeta" };
  }

  const locked = taskId ? await contentLocked(taskId) : false;
  let content: ReturnType<typeof fromDraft> | null = null;
  if (!locked) {
    try {
      content = fromDraft(m.type, input.draft);
      parseTask({ type: m.type, ...content }); // final guard: same rules as the seed and tests
    } catch (e) {
      if (e instanceof DraftInvalid) return { ok: false, error: e.code, question: e.question };
      return { ok: false, error: "invalid", detail: e instanceof Error ? e.message : String(e) };
    }
  } else if (taskId) {
    const current = await db.task.findUniqueOrThrow({ where: { id: taskId }, select: { type: true } });
    if (current.type !== m.type) return { ok: false, error: "locked" };
  }

  const building = await db.buildingType.findUniqueOrThrow({ where: { key: m.building }, select: { id: true } });
  const data = {
    title: m.title,
    instruction: m.instruction,
    buildingTypeId: building.id,
    topicId: m.topicId || null,
    difficulty: m.difficulty,
    timeLimitSec: m.timeLimitMin ? m.timeLimitMin * 60 : null,
    maxAttempts: m.maxAttempts,
    explanation: m.explanation || null,
    ...(input.publish ? { status: "PUBLISHED" as const } : {}),
    ...(content
      ? {
          type: m.type,
          grading: gradingFor(m.type),
          content: content.content as Prisma.InputJsonObject,
          answerKey: (content.answerKey as Prisma.InputJsonObject | null) ?? undefined,
          criteria: (content.criteria as Prisma.InputJsonArray | null) ?? undefined,
        }
      : {}),
  };

  const task = taskId
    ? await db.task.update({ where: { id: taskId }, data, select: { id: true } })
    : await db.task.create({
        data: {
          ...data,
          type: m.type,
          grading: gradingFor(m.type),
          content: content!.content as Prisma.InputJsonObject,
          authorId: user.id,
          status: input.publish ? "PUBLISHED" : "DRAFT",
        },
        select: { id: true },
      });
  await audit({
    actorId: user.id,
    action: taskId ? "task.update" : "task.create",
    entity: "Task",
    entityId: task.id,
    data: { publish: input.publish, contentChanged: !!content },
  });
  refresh();
  return { ok: true, id: task.id };
}

export async function setTaskStatus(taskId: string, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertOwnsTask(user, taskId);
  await db.task.update({ where: { id: taskId }, data: { status } });
  await audit({ actorId: user.id, action: `task.status.${status.toLowerCase()}`, entity: "Task", entityId: taskId });
  refresh();
}

/** Copy of a task as a new draft (to change a task whose content is locked). */
export async function duplicateTask(taskId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertOwnsTask(user, taskId);
  const t = await db.task.findUniqueOrThrow({ where: { id: taskId } });
  const copy = await db.task.create({
    data: {
      authorId: user.id,
      topicId: t.topicId,
      buildingTypeId: t.buildingTypeId,
      type: t.type,
      grading: t.grading,
      status: "DRAFT",
      title: `${t.title} (2)`,
      instruction: t.instruction,
      content: t.content ?? {},
      answerKey: t.answerKey ?? undefined,
      criteria: t.criteria ?? undefined,
      explanation: t.explanation,
      difficulty: t.difficulty,
      timeLimitSec: t.timeLimitSec,
      maxAttempts: t.maxAttempts,
    },
  });
  await audit({
    actorId: user.id,
    action: "task.duplicate",
    entity: "Task",
    entityId: copy.id,
    data: { from: taskId },
  });
  redirect({ href: `/teacher/tasks/${copy.id}`, locale: await getLocale() });
}

/** Delete a task that nobody has answered yet; otherwise archive it. */
export async function deleteTask(taskId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertOwnsTask(user, taskId);
  if (await contentLocked(taskId)) {
    await db.task.update({ where: { id: taskId }, data: { status: "ARCHIVED" } });
  } else {
    await db.task.delete({ where: { id: taskId } });
  }
  await audit({ actorId: user.id, action: "task.delete", entity: "Task", entityId: taskId });
  refresh();
  redirect({ href: "/teacher/tasks", locale: await getLocale() });
}

/* -------------------------------------------------------------- assignments */

export type AssignResult = { ok?: boolean; error?: "invalid" | "forbidden" } | undefined;

const assignSchema = z.object({
  target: z.string().regex(/^(class|student):[A-Za-z0-9_-]{1,40}$/),
  required: z.boolean(),
  deadline: z.string().optional(),
});

/** Assign to a whole class or to one student, with deadline and required flag (spec §2.2). */
export async function assignTask(taskId: string, _prev: AssignResult, formData: FormData): Promise<AssignResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertOwnsTask(user, taskId);
  const parsed = assignSchema.safeParse({
    target: formData.get("target"),
    required: formData.get("required") === "on",
    deadline: String(formData.get("deadline") ?? "") || undefined,
  });
  if (!parsed.success) return { error: "invalid" };
  const [kind, id] = parsed.data.target.split(":");
  try {
    if (kind === "class") await assertTeachesClass(user, id);
    else await assertTeachesStudent(user, id);
  } catch (e) {
    if (e instanceof AuthError) return { error: "forbidden" };
    throw e;
  }
  // Deadline = end of the chosen day, Almaty time (UTC+5).
  const deadline = parsed.data.deadline ? new Date(`${parsed.data.deadline}T23:59:00+05:00`) : null;
  if (deadline && Number.isNaN(deadline.getTime())) return { error: "invalid" };

  const where =
    kind === "class" ? { taskId_classId: { taskId, classId: id } } : { taskId_studentId: { taskId, studentId: id } };
  await db.taskAssignment.upsert({
    where: where as never,
    update: { isRequired: parsed.data.required, deadline },
    create: {
      taskId,
      assignedById: user.id,
      isRequired: parsed.data.required,
      deadline,
      ...(kind === "class" ? { classId: id } : { studentId: id }),
    },
  });
  await audit({ actorId: user.id, action: "task.assign", entity: "Task", entityId: taskId, data: { kind, id } });
  refresh();
  return { ok: true };
}

export async function removeAssignment(assignmentId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  const a = await db.taskAssignment.findUnique({ where: { id: assignmentId }, select: { taskId: true } });
  if (!a) return;
  await assertOwnsTask(user, a.taskId);
  await db.taskAssignment.delete({ where: { id: assignmentId } });
  await audit({ actorId: user.id, action: "task.unassign", entity: "Task", entityId: a.taskId });
  refresh();
}

/* ---------------------------------------------------------------- materials */

export async function addTextMaterial(taskId: string, _prev: AssignResult, formData: FormData): Promise<AssignResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertOwnsTask(user, taskId);
  const title = String(formData.get("title") ?? "")
    .trim()
    .slice(0, 160);
  const body = String(formData.get("body") ?? "")
    .trim()
    .slice(0, 10_000);
  if (!title || !body) return { error: "invalid" };
  await db.material.create({ data: { taskId, uploadedById: user.id, kind: "TEXT", title, body } });
  refresh();
  return { ok: true };
}

export async function deleteMaterial(materialId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  const m = await db.material.findUnique({ where: { id: materialId }, select: { taskId: true } });
  if (!m?.taskId) return;
  await assertOwnsTask(user, m.taskId);
  await db.material.delete({ where: { id: materialId } });
  refresh();
}
