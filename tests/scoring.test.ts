import { describe, expect, it } from "vitest";
import { aggregateScore, type GradedResult } from "@/lib/domain/scoring";

const r = (taskId: string, score: number, required = true): GradedResult => ({ taskId, score, required });

describe("aggregateScore (spec §4)", () => {
  it("nothing graded → null (building unchanged)", () => {
    expect(aggregateScore("BEST", [])).toBeNull();
    expect(aggregateScore("AVERAGE", [])).toBeNull();
    expect(aggregateScore("REQUIRED_ONLY", [r("a", 9, false)])).toBeNull();
  });

  it("spec example: one spelling task with 5 → 5 (small palace)", () => {
    expect(aggregateScore("BEST", [r("nn", 5)])).toBe(5);
  });

  it("BEST takes the best attempt of each task, then averages tasks", () => {
    expect(aggregateScore("BEST", [r("a", 5), r("a", 8), r("b", 6)])).toBe(7);
  });

  it("AVERAGE counts every attempt (retakes included)", () => {
    expect(aggregateScore("AVERAGE", [r("a", 5), r("a", 8), r("b", 6)])).toBe(6.3);
  });

  it("REQUIRED_ONLY ignores optional tasks", () => {
    expect(aggregateScore("REQUIRED_ONLY", [r("a", 6), r("extra", 10, false)])).toBe(6);
    expect(aggregateScore("BEST", [r("a", 6), r("extra", 10, false)])).toBe(8);
  });
});
