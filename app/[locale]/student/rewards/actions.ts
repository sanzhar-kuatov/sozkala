"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DECORATION_SLOTS, toStored } from "@/components/city/engine/decorations";
import { audit } from "@/lib/audit";
import { authorize } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export type ShopResult = { ok: true } | { ok: false; error: "notEnough" | "invalid" | "taken" };

const refresh = () => revalidatePath("/[locale]/student", "layout");

async function ownCity(userId: string) {
  return db.city.findUniqueOrThrow({ where: { studentId: userId }, select: { id: true } });
}

/** Buy a decoration with building materials (spec §6: decorations never replace learning results). */
export async function buyDecoration(key: string): Promise<ShopResult> {
  const user = await authorize(["STUDENT"], { write: true });
  const decoration = await db.decoration.findUnique({ where: { key: z.string().max(40).parse(key) } });
  if (!decoration) return { ok: false, error: "invalid" };
  const city = await ownCity(user.id);

  const ok = await db.$transaction(async (tx) => {
    // Conditional decrement: never goes below zero even with two quick clicks.
    const { count } = await tx.city.updateMany({
      where: { id: city.id, materials: { gte: decoration.costMaterials } },
      data: { materials: { decrement: decoration.costMaterials } },
    });
    if (count !== 1) return false;
    await tx.cityDecoration.create({ data: { cityId: city.id, decorationId: decoration.id } });
    if (decoration.costMaterials > 0) {
      await tx.rewardTransaction.create({
        data: { studentId: user.id, kind: "MATERIALS", amount: -decoration.costMaterials, reason: "decoration.buy" },
      });
    }
    return true;
  });
  if (!ok) return { ok: false, error: "notEnough" };
  await audit({ actorId: user.id, action: "decoration.buy", entity: "City", entityId: city.id, data: { key } });
  refresh();
  return { ok: true };
}

/** Put an owned decoration on a free street slot. */
export async function placeDecoration(decorationId: string, slot: number): Promise<ShopResult> {
  const user = await authorize(["STUDENT"], { write: true });
  const city = await ownCity(user.id);
  if (!Number.isInteger(slot) || slot < 0 || slot >= DECORATION_SLOTS.length) return { ok: false, error: "invalid" };
  const { x, y } = toStored(DECORATION_SLOTS[slot]);

  const own = await db.cityDecoration.findFirst({ where: { id: decorationId, cityId: city.id } });
  if (!own) return { ok: false, error: "invalid" };
  const taken = await db.cityDecoration.findFirst({ where: { cityId: city.id, x, y, id: { not: decorationId } } });
  if (taken) return { ok: false, error: "taken" };

  await db.cityDecoration.update({ where: { id: decorationId }, data: { x, y } });
  refresh();
  return { ok: true };
}

/** Back to the inventory (the decoration is kept, nothing is refunded). */
export async function removeDecoration(decorationId: string): Promise<ShopResult> {
  const user = await authorize(["STUDENT"], { write: true });
  const city = await ownCity(user.id);
  const { count } = await db.cityDecoration.updateMany({
    where: { id: decorationId, cityId: city.id },
    data: { x: null, y: null },
  });
  if (count !== 1) return { ok: false, error: "invalid" };
  refresh();
  return { ok: true };
}
