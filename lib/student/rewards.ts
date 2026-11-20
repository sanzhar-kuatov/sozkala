import "server-only";
import type { PlacedDecoration } from "@/components/city/engine/decorations";
import { assertCanViewStudent } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/** Rewards page data (spec §2.1 "collect building materials, achievements and rewards"; §6). */
export async function getRewardsView(viewer: SessionUser, studentId: string) {
  await assertCanViewStudent(viewer, studentId);
  const city = await db.city.findUnique({
    where: { studentId },
    select: {
      id: true,
      name: true,
      points: true,
      materials: true,
      stars: true,
      buildings: { select: { level: true, building: { select: { key: true } } } },
      decorations: { select: { id: true, x: true, y: true, decoration: { select: { key: true } } } },
    },
  });
  if (!city) return null;

  const [achievements, earned, catalog, ledger] = await Promise.all([
    db.achievement.findMany({ orderBy: { sortOrder: "asc" } }),
    db.studentAchievement.findMany({ where: { studentId }, select: { achievementId: true, earnedAt: true } }),
    db.decoration.findMany({ orderBy: { sortOrder: "asc" } }),
    db.rewardTransaction.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        kind: true,
        amount: true,
        reason: true,
        createdAt: true,
        attempt: { select: { task: { select: { title: true } } } },
      },
    }),
  ]);
  const earnedAt = new Map(earned.map((e) => [e.achievementId, e.earnedAt]));

  return {
    city: { id: city.id, name: city.name, points: city.points, materials: city.materials, stars: city.stars },
    levels: Object.fromEntries(city.buildings.map((b) => [b.building.key, b.level])),
    achievements: achievements.map((a) => ({
      key: a.key,
      name: { kk: a.nameKk, ru: a.nameRu },
      description: { kk: a.descriptionKk, ru: a.descriptionRu },
      icon: a.icon,
      color: a.color,
      earnedAt: earnedAt.get(a.id) ?? null,
    })),
    catalog: catalog.map((d) => ({
      key: d.key,
      kind: d.kind,
      name: { kk: d.nameKk, ru: d.nameRu },
      cost: d.costMaterials,
    })),
    inventory: city.decorations.filter((d) => d.x == null).map((d) => ({ id: d.id, key: d.decoration.key })),
    placed: city.decorations
      .filter((d) => d.x != null && d.y != null)
      .map((d): PlacedDecoration => ({ id: d.id, key: d.decoration.key, x: d.x!, y: d.y! })),
    ledger: ledger.map((l) => ({ ...l, task: l.attempt?.task.title ?? null })),
  };
}

export type RewardsView = NonNullable<Awaited<ReturnType<typeof getRewardsView>>>;

/** Placed decorations of a city (shown on every city map). */
export async function placedDecorations(cityId: string): Promise<PlacedDecoration[]> {
  const rows = await db.cityDecoration.findMany({
    where: { cityId, x: { not: null }, y: { not: null } },
    select: { id: true, x: true, y: true, decoration: { select: { key: true } } },
  });
  return rows.map((d) => ({ id: d.id, key: d.decoration.key, x: d.x!, y: d.y! }));
}
