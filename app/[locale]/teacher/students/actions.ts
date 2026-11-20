"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { AuthError, authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { assertOwnsTask, assertTeachesStudent } from "@/lib/teacher/access";

export type StudentActionResult = { ok?: boolean; error?: "invalid" | "forbidden" } | undefined;

/** "Allow a retake" (spec §2.2): extra attempts for one student on one task. */
export async function grantRetake(
  studentId: string,
  _prev: StudentActionResult,
  formData: FormData,
): Promise<StudentActionResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesStudent(user, studentId);
  const parsed = z
    .object({ taskId: z.string().min(1).max(40), extra: z.coerce.number().int().min(1).max(5) })
    .safeParse({ taskId: formData.get("taskId"), extra: formData.get("extra") ?? 1 });
  if (!parsed.success) return { error: "invalid" };
  try {
    await assertOwnsTask(user, parsed.data.taskId);
  } catch (e) {
    if (e instanceof AuthError) return { error: "forbidden" };
    throw e;
  }
  await db.attemptAllowance.create({
    data: { taskId: parsed.data.taskId, studentId, extraAttempts: parsed.data.extra, grantedById: user.id },
  });
  await audit({
    actorId: user.id,
    action: "attempt.allowance",
    entity: "User",
    entityId: studentId,
    data: parsed.data,
  });
  revalidatePath("/[locale]/teacher/students/[id]", "page");
  return { ok: true };
}

/** Individual assignment (spec §2.2 "assign a personal task"). */
export async function assignPersonalTask(
  studentId: string,
  _prev: StudentActionResult,
  formData: FormData,
): Promise<StudentActionResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesStudent(user, studentId);
  const parsed = z
    .object({ taskId: z.string().min(1).max(40), required: z.boolean(), deadline: z.string().optional() })
    .safeParse({
      taskId: formData.get("taskId"),
      required: formData.get("required") === "on",
      deadline: String(formData.get("deadline") ?? "") || undefined,
    });
  if (!parsed.success) return { error: "invalid" };
  try {
    await assertOwnsTask(user, parsed.data.taskId);
  } catch (e) {
    if (e instanceof AuthError) return { error: "forbidden" };
    throw e;
  }
  const deadline = parsed.data.deadline ? new Date(`${parsed.data.deadline}T23:59:00+05:00`) : null;
  await db.taskAssignment.upsert({
    where: { taskId_studentId: { taskId: parsed.data.taskId, studentId } },
    update: { isRequired: parsed.data.required, deadline },
    create: {
      taskId: parsed.data.taskId,
      studentId,
      assignedById: user.id,
      isRequired: parsed.data.required,
      deadline,
    },
  });
  await audit({
    actorId: user.id,
    action: "task.assign.personal",
    entity: "User",
    entityId: studentId,
    data: { taskId: parsed.data.taskId },
  });
  revalidatePath("/[locale]/teacher/students/[id]", "page");
  return { ok: true };
}
