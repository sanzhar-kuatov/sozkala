/**
 * Score → building level rules (spec §4, docs/design/02-isometric-art-spec.md §3).
 * Pure functions — shared by grading (Stage 6), the city (Stage 4) and the seed.
 */

export const MAX_SCORE = 10;
export const MAX_LEVEL = 5;
export type Level = 0 | 1 | 2 | 3 | 4 | 5;

/** Lowest score needed for each level 1…5. */
export const LEVEL_THRESHOLDS = { 1: 1, 2: 4, 3: 6, 4: 8, 5: 10 } as const;

/**
 * 10 → L5 · 8–9 → L4 · 6–7 → L3 · 4–5 → L2 · 1–3 → L1 · otherwise L0 (empty lot).
 * Fractional aggregates must reach the threshold: 7.9 → L3.
 */
export function levelForScore(score: number | null | undefined): Level {
  if (score == null || Number.isNaN(score)) return 0;
  if (score >= 10) return 5;
  if (score >= 8) return 4;
  if (score >= 6) return 3;
  if (score >= 4) return 2;
  if (score >= 1) return 1;
  return 0;
}

/** A building never goes down: the displayed level is the max of the old one and the new one (§4). */
export function nextLevel(previous: number, score: number | null | undefined): Level {
  return Math.max(clampLevel(previous), levelForScore(score)) as Level;
}

/** Score still needed for the next level, or null at the top. */
export function scoreForNextLevel(level: number): number | null {
  const next = clampLevel(level) + 1;
  return next > MAX_LEVEL ? null : LEVEL_THRESHOLDS[next as keyof typeof LEVEL_THRESHOLDS];
}

/** City completion in % = Σ levels / (buildings × 5). */
export function cityCompletion(levels: readonly number[], buildingCount = 8): number {
  if (buildingCount <= 0) return 0;
  const sum = levels.reduce((s, l) => s + clampLevel(l), 0);
  return Math.round((sum / (buildingCount * MAX_LEVEL)) * 100);
}

function clampLevel(level: number): Level {
  return Math.max(0, Math.min(MAX_LEVEL, Math.trunc(level || 0))) as Level;
}
