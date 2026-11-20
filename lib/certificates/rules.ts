/**
 * Certificate rules (spec §7) — pure, unit-tested in tests/certificates.test.ts.
 *
 * A student earns «СӨЗҚАЛАНЫҢ БАС СӘУЛЕТШІСІ» when every required task has a
 * graded result and every required ("core") building has reached the policy's
 * minimum level. The final score is the average of the required buildings'
 * aggregate scores; the tier comes from the teacher/admin thresholds.
 */

export const TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;
export type Tier = (typeof TIERS)[number];

/** Seal colours from docs/design/01-design-system.md. */
export const TIER_COLOR: Record<Tier, string> = {
  BRONZE: "#CD7F32",
  SILVER: "#A9B4C2",
  GOLD: "#F2B705",
  PLATINUM: "#7FC8DC",
};

export type Policy = {
  bronzeMin: number;
  silverMin: number;
  goldMin: number;
  platinumMin: number;
  /** Every required building must reach at least this level. */
  minBuildingLevel: number;
};

export const DEFAULT_POLICY: Policy = {
  bronzeMin: 6,
  silverMin: 7.5,
  goldMin: 8.5,
  platinumMin: 9.5,
  minBuildingLevel: 3,
};

export function tierFor(score: number | null, p: Policy): Tier | null {
  if (score == null) return null;
  if (score >= p.platinumMin) return "PLATINUM";
  if (score >= p.goldMin) return "GOLD";
  if (score >= p.silverMin) return "SILVER";
  if (score >= p.bronzeMin) return "BRONZE";
  return null;
}

export const tierRank = (t: Tier | null) => (t ? TIERS.indexOf(t) : -1);

/** Thresholds must rise bronze < silver < gold < platinum within 0–10; the building level is 1–5. */
export function policyError(p: Policy): "order" | "range" | null {
  const values = [p.bronzeMin, p.silverMin, p.goldMin, p.platinumMin];
  if (values.some((v) => !Number.isFinite(v) || v < 0 || v > 10)) return "range";
  if (!Number.isInteger(p.minBuildingLevel) || p.minBuildingLevel < 1 || p.minBuildingLevel > 5) return "range";
  for (let i = 1; i < values.length; i++) if (values[i] <= values[i - 1]) return "order";
  return null;
}

export type EligibilityInput = {
  requiredTasks: { id: string; title: string; done: boolean }[];
  buildings: { key: string; required: boolean; level: number; score: number | null }[];
  policy: Policy;
};

export type Eligibility = {
  tasks: { done: number; total: number; missing: string[] };
  buildings: { built: number; total: number; missing: string[] };
  finalScore: number | null;
  tier: Tier | null;
  eligible: boolean;
};

export function evaluateEligibility({ requiredTasks, buildings, policy }: EligibilityInput): Eligibility {
  const core = buildings.filter((b) => b.required);
  const built = core.filter((b) => b.level >= policy.minBuildingLevel);
  const scored = core.filter((b) => b.score != null).map((b) => b.score!);
  const finalScore = scored.length ? Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10 : null;
  const tier = tierFor(finalScore, policy);
  const tasksDone = requiredTasks.filter((t) => t.done).length;

  return {
    tasks: {
      done: tasksDone,
      total: requiredTasks.length,
      missing: requiredTasks.filter((t) => !t.done).map((t) => t.title),
    },
    buildings: {
      built: built.length,
      total: core.length,
      missing: core.filter((b) => b.level < policy.minBuildingLevel).map((b) => b.key),
    },
    finalScore,
    tier,
    eligible: core.length > 0 && built.length === core.length && tasksDone === requiredTasks.length && tier != null,
  };
}

/** SZ-2026-000001 */
export const formatSerial = (year: number, n: number) => `SZ-${year}-${String(n).padStart(6, "0")}`;
