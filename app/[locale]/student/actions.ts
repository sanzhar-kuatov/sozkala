"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CITY_NAME_MAX } from "@/lib/domain/city";

const nameSchema = z.string().trim().min(1).max(CITY_NAME_MAX);

/** §2.1 "give your city a name". Returns the saved name or an error code. */
export async function renameCity(name: string): Promise<{ ok: true; name: string } | { ok: false; error: "invalid" }> {
  const user = await authorize(["STUDENT"], { write: true });
  const parsed = nameSchema.safeParse(name);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const city = await db.city.update({
    where: { studentId: user.id },
    data: { name: parsed.data },
    select: { id: true },
  });
  await audit({
    actorId: user.id,
    action: "city.rename",
    entity: "City",
    entityId: city.id,
    data: { name: parsed.data },
  });
  revalidatePath("/[locale]/student", "layout");
  return { ok: true, name: parsed.data };
}

/** Marks "level up" notifications as seen after the build animation has played. */
export async function markLevelUpsSeen(ids: string[]) {
  const user = await authorize(["STUDENT"], { write: true });
  const safeIds = z.array(z.string().max(40)).max(50).parse(ids);
  await db.notification.updateMany({
    where: { id: { in: safeIds }, recipientId: user.id, type: "LEVEL_UP", readAt: null },
    data: { readAt: new Date() },
  });
}
