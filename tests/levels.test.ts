import { describe, expect, it } from "vitest";
import { cityCompletion, levelForScore, nextLevel, scoreForNextLevel } from "@/lib/domain/levels";

describe("levelForScore (spec §4)", () => {
  it.each([
    [null, 0],
    [0, 0],
    [0.5, 0],
    [1, 1],
    [3, 1],
    [4, 2],
    [5, 2],
    [6, 3],
    [7, 3],
    [7.9, 3], // fractional aggregates must reach the threshold
    [8, 4],
    [9, 4],
    [9.99, 4],
    [10, 5],
  ])("score %s → level %i", (score, level) => {
    expect(levelForScore(score)).toBe(level);
  });
});

describe("nextLevel — a building never goes down", () => {
  it("rises with a better score", () => expect(nextLevel(2, 7)).toBe(3));
  it("keeps the level after a worse score", () => expect(nextLevel(4, 3)).toBe(4));
  it("spec example: 5 → 8 → 10", () => {
    let level = nextLevel(0, 5);
    expect(level).toBe(2);
    level = nextLevel(level, 8);
    expect(level).toBe(4);
    level = nextLevel(level, 10);
    expect(level).toBe(5);
  });
});

describe("scoreForNextLevel", () => {
  it("returns the next threshold", () => {
    expect(scoreForNextLevel(0)).toBe(1);
    expect(scoreForNextLevel(3)).toBe(8);
    expect(scoreForNextLevel(5)).toBeNull();
  });
});

describe("cityCompletion", () => {
  it("is Σ levels / 40", () => {
    expect(cityCompletion([0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
    expect(cityCompletion([5, 5, 5, 5, 5, 5, 5, 5])).toBe(100);
    expect(cityCompletion([3, 1, 2, 3, 4, 0, 5, 0])).toBe(45);
  });
});
