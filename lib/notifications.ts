import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationType } from "@/generated/prisma/enums";
import { db } from "@/lib/db";

type Tx = Prisma.TransactionClient | typeof db;

/** Creates in-cabinet notifications (spec §8; e-mail delivery is a later feature). */
export async function notify(
  tx: Tx,
  recipients: string[],
  type: NotificationType,
  payload: Record<string, unknown>,
  subjectId?: string,
) {
  if (recipients.length === 0) return;
  await tx.notification.createMany({
    data: recipients.map((recipientId) => ({ recipientId, type, payload: payload as object, subjectId })),
  });
}

/** Parents linked to a student. */
export async function parentsOf(tx: Tx, studentId: string) {
  return (await tx.parentLink.findMany({ where: { studentId }, select: { parentId: true } })).map((l) => l.parentId);
}

/** Teachers of the classes a student belongs to. */
export async function teachersOf(tx: Tx, studentId: string) {
  const classes = await tx.classMember.findMany({
    where: { studentId, class: { archivedAt: null } },
    select: { class: { select: { teacherId: true } } },
  });
  return [...new Set(classes.map((c) => c.class.teacherId))];
}
