/**
 * Building score aggregation (spec §4: "the method of computing the aggregate
 * score — average, best result, or required tasks — is chosen by the teacher").
 *
 * Only tasks the student has a graded attempt for count, so a building reflects
 * the work done so far (spec example: one spelling task with 5 points → a small
 * palace). Pure function, shared by grading and the demo seed.
 */
import type { ScoringMode } from "@/generated/prisma/enums";

export type GradedResult = { taskId: string; score: number; required: boolean };

const round1 = (n: number) => Math.round(n * 10) / 10;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

function bestPerTask(results: GradedResult[]) {
  const best = new Map<string, number>();
  for (const r of results) best.set(r.taskId, Math.max(best.get(r.taskId) ?? 0, r.score));
  return [...best.values()];
}

/**
 * BEST          — best score of each task, averaged over the tasks done.
 * AVERAGE       — average of every graded attempt (retakes included).
 * REQUIRED_ONLY — like BEST, but only required tasks count.
 * Returns null when nothing counts yet (the building stays as it is).
 */
export function aggregateScore(mode: ScoringMode, results: GradedResult[]): number | null {
  switch (mode) {
    case "AVERAGE":
      return results.length ? round1(mean(results.map((r) => r.score))) : null;
    case "REQUIRED_ONLY": {
      const best = bestPerTask(results.filter((r) => r.required));
      return best.length ? round1(mean(best)) : null;
    }
    case "BEST":
    default: {
      const best = bestPerTask(results);
      return best.length ? round1(mean(best)) : null;
    }
  }
}
