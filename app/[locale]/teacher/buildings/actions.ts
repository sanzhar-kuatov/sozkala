"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { assertTeachesClass } from "@/lib/teacher/access";

export type ConfigResult = { ok?: boolean; error?: "invalid" | "cycle" } | undefined;

const rowSchema = z.object({
  order: z.coerce.number().int().min(1).max(8),
  required: z.boolean(),
  mode: z.enum(["BEST", "AVERAGE", "REQUIRED_ONLY"]),
  after: z.union([z.literal(""), z.enum(BUILDINGS.map((b) => b.key) as [BuildingKey, ...BuildingKey[]])]),
  minLevel: z.coerce.number().int().min(1).max(5),
});

/** Per-class building settings (spec §3: order and required are set by the teacher; §4: scoring mode). */
export async function saveBuildingConfig(
  classId: string,
  _prev: ConfigResult,
  formData: FormData,
): Promise<ConfigResult> {
  const user = await authorize(["TEACHER", "ADMIN"], { write: true });
  await assertTeachesClass(user, classId);

  const rows = new Map<BuildingKey, z.infer<typeof rowSchema>>();
  for (const { key } of BUILDINGS) {
    const parsed = rowSchema.safeParse({
      order: formData.get(`order_${key}`),
      required: formData.get(`required_${key}`) === "on",
      mode: formData.get(`mode_${key}`),
      after: formData.get(`after_${key}`) ?? "",
      minLevel: formData.get(`min_${key}`) ?? 2,
    });
    if (!parsed.success || parsed.data.after === key) return { error: "invalid" };
    rows.set(key, parsed.data);
  }

  // Unlock rules must not form a loop (A waits for B, B waits for A → both locked forever).
  for (const start of rows.keys()) {
    const seen = new Set<string>();
    let cur: string = start;
    while (rows.get(cur as BuildingKey)?.after) {
      if (seen.has(cur)) return { error: "cycle" };
      seen.add(cur);
      cur = rows.get(cur as BuildingKey)!.after;
    }
  }

  const types = await db.buildingType.findMany({ select: { id: true, key: true } });
  const idOf = (key: string) => types.find((t) => t.key === key)!.id;
  await db.$transaction(
    [...rows].map(([key, r]) =>
      db.classBuildingConfig.upsert({
        where: { classId_buildingTypeId: { classId, buildingTypeId: idOf(key) } },
        update: {
          unlockOrder: r.order,
          isRequired: r.required,
          scoringMode: r.mode,
          unlockAfterId: r.after ? idOf(r.after) : null,
          unlockMinLevel: r.minLevel,
        },
        create: {
          classId,
          buildingTypeId: idOf(key),
          unlockOrder: r.order,
          isRequired: r.required,
          scoringMode: r.mode,
          unlockAfterId: r.after ? idOf(r.after) : null,
          unlockMinLevel: r.minLevel,
        },
      }),
    ),
  );
  await audit({ actorId: user.id, action: "class.buildings.update", entity: "SchoolClass", entityId: classId });
  revalidatePath("/[locale]/teacher/buildings", "page");
  return { ok: true };
}
