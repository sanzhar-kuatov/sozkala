"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { AuthError, authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { isBuildingKey } from "@/lib/domain/buildings";

export type TopicResult = { ok?: boolean; at?: number; error?: "invalid" } | undefined;

const topicSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  building: z.string().refine((k) => k === "" || isBuildingKey(k)),
});

async function ownTopic(userId: string, role: string, topicId: string) {
  const topic = await db.topic.findFirst({ where: { id: topicId, ...(role === "ADMIN" ? {} : { authorId: userId }) } });
  if (!topic) throw new AuthError("FORBIDDEN");
  return topic;
}

async function buildingId(key: string) {
  return key ? ((await db.buildingType.findUnique({ where: { key }, select: { id: true } }))?.id ?? null) : null;
}

export async function createTopic(_prev: TopicResult, formData: FormData): Promise<TopicResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  const parsed = topicSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    building: formData.get("building") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };
  const topic = await db.topic.create({
    data: {
      authorId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      buildingTypeId: await buildingId(parsed.data.building),
    },
  });
  await audit({ actorId: user.id, action: "topic.create", entity: "Topic", entityId: topic.id });
  revalidatePath("/[locale]/teacher/topics", "page");
  return { ok: true, at: Date.now() }; // `at` resets the form on the client
}

export async function updateTopic(topicId: string, _prev: TopicResult, formData: FormData): Promise<TopicResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await ownTopic(user.id, user.role, topicId);
  const parsed = topicSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    building: formData.get("building") ?? "",
  });
  if (!parsed.success) return { error: "invalid" };
  await db.topic.update({
    where: { id: topicId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      buildingTypeId: await buildingId(parsed.data.building),
    },
  });
  await audit({ actorId: user.id, action: "topic.update", entity: "Topic", entityId: topicId });
  revalidatePath("/[locale]/teacher/topics", "page");
  return { ok: true };
}

/** Deleting a topic keeps its tasks (they become "no topic"). */
export async function deleteTopic(topicId: string) {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await ownTopic(user.id, user.role, topicId);
  await db.topic.delete({ where: { id: topicId } });
  await audit({ actorId: user.id, action: "topic.delete", entity: "Topic", entityId: topicId });
  revalidatePath("/[locale]/teacher/topics", "page");
}
