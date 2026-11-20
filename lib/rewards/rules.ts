/**
 * Rewards and achievements (spec §6: knowledge points, building materials,
 * mastery stars and achievement badges). Pure functions, shared by grading
 * (lib/grading/progress.ts) and the demo seed.
 *
 * Rewards are paid for *improvement*, so retaking a task cannot farm points:
 *   points    = 10 × (new best score − previous best score on this task), ≥ 0
 *   materials = 5 per building level gained (spent on decorations)
 *   stars     = 1 the first time a task reaches 9+ points
 */
import type { BuildingKey } from "@/lib/domain/buildings";

export const POINTS_PER_SCORE_POINT = 10;
export const MATERIALS_PER_LEVEL = 5;
export const STAR_SCORE = 9;

export type Reward = { points: number; materials: number; stars: number };

export function rewardFor(args: { score: number; previousBest: number | null; levelsGained: number }): Reward {
  const before = args.previousBest ?? 0;
  return {
    points: Math.max(0, Math.round((args.score - before) * POINTS_PER_SCORE_POINT)),
    materials: Math.max(0, args.levelsGained) * MATERIALS_PER_LEVEL,
    stars: args.score >= STAR_SCORE && before < STAR_SCORE ? 1 : 0,
  };
}

/* ------------------------------------------------------------- achievements */

export type AchievementRule =
  | { type: "buildings_built"; count: number; minLevel: number }
  | { type: "building_level"; building: BuildingKey; level: number }
  | { type: "buildings_level"; buildings: readonly BuildingKey[]; level: number }
  | { type: "all_buildings"; level: number }
  | { type: "perfect_score" }
  | { type: "improved_retake" };

export type StudentProgress = {
  levels: Partial<Record<BuildingKey, number>>;
  /** graded attempts in chronological order */
  results: { taskId: string; score: number }[];
};

export function meetsRule(rule: AchievementRule, p: StudentProgress): boolean {
  const level = (k: BuildingKey) => p.levels[k] ?? 0;
  switch (rule.type) {
    case "buildings_built":
      return Object.values(p.levels).filter((l) => (l ?? 0) >= rule.minLevel).length >= rule.count;
    case "building_level":
      return level(rule.building) >= rule.level;
    case "buildings_level":
      return rule.buildings.every((b) => level(b) >= rule.level);
    case "all_buildings": {
      const all = Object.values(p.levels);
      return all.length >= 8 && all.every((l) => (l ?? 0) >= rule.level);
    }
    case "perfect_score":
      return p.results.some((r) => r.score >= 10);
    case "improved_retake": {
      const first = new Map<string, number>();
      for (const r of p.results) {
        if (!first.has(r.taskId)) first.set(r.taskId, r.score);
        else if (r.score > first.get(r.taskId)!) return true;
      }
      return false;
    }
  }
}

/** Keys of the achievements whose rule is met (the caller filters out already earned ones). */
export function earnedAchievements(all: { key: string; rule: unknown }[], p: StudentProgress): string[] {
  return all.filter((a) => meetsRule(a.rule as AchievementRule, p)).map((a) => a.key);
}
