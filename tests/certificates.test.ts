import { describe, expect, it } from "vitest";
import {
  DEFAULT_POLICY,
  evaluateEligibility,
  formatSerial,
  policyError,
  tierFor,
  tierRank,
} from "@/lib/certificates/rules";

const building = (key: string, level: number, score: number | null, required = true) => ({
  key,
  level,
  score,
  required,
});

describe("certificate tiers", () => {
  it("maps the final score to the default thresholds", () => {
    expect(tierFor(null, DEFAULT_POLICY)).toBeNull();
    expect(tierFor(5.9, DEFAULT_POLICY)).toBeNull();
    expect(tierFor(6, DEFAULT_POLICY)).toBe("BRONZE");
    expect(tierFor(7.5, DEFAULT_POLICY)).toBe("SILVER");
    expect(tierFor(8.5, DEFAULT_POLICY)).toBe("GOLD");
    expect(tierFor(9.5, DEFAULT_POLICY)).toBe("PLATINUM");
    expect(tierFor(10, DEFAULT_POLICY)).toBe("PLATINUM");
  });

  it("orders tiers", () => {
    expect(tierRank(null)).toBeLessThan(tierRank("BRONZE"));
    expect(tierRank("GOLD")).toBeGreaterThan(tierRank("SILVER"));
  });

  it("rejects thresholds that do not rise or leave 0–10", () => {
    expect(policyError(DEFAULT_POLICY)).toBeNull();
    expect(policyError({ ...DEFAULT_POLICY, silverMin: 6 })).toBe("order");
    expect(policyError({ ...DEFAULT_POLICY, platinumMin: 11 })).toBe("range");
    expect(policyError({ ...DEFAULT_POLICY, minBuildingLevel: 0 })).toBe("range");
    expect(policyError({ ...DEFAULT_POLICY, minBuildingLevel: 2.5 })).toBe("range");
  });
});

describe("certificate eligibility (spec §7, acceptance #9)", () => {
  const tasks = [
    { id: "a", title: "A", done: true },
    { id: "b", title: "B", done: true },
  ];

  it("is eligible when all required tasks are graded and core buildings reach the level", () => {
    const r = evaluateEligibility({
      requiredTasks: tasks,
      buildings: [building("grammar", 5, 10), building("bridge", 3, 7), building("park", 0, null, false)],
      policy: DEFAULT_POLICY,
    });
    expect(r).toMatchObject({ eligible: true, finalScore: 8.5, tier: "GOLD" });
    expect(r.buildings).toEqual({ built: 2, total: 2, missing: [] });
  });

  it("an unfinished required task blocks it and is listed", () => {
    const r = evaluateEligibility({
      requiredTasks: [...tasks, { id: "c", title: "C", done: false }],
      buildings: [building("grammar", 5, 10)],
      policy: DEFAULT_POLICY,
    });
    expect(r.eligible).toBe(false);
    expect(r.tasks).toEqual({ done: 2, total: 3, missing: ["C"] });
  });

  it("a core building below the minimum level blocks it", () => {
    const r = evaluateEligibility({
      requiredTasks: tasks,
      buildings: [building("grammar", 5, 10), building("bridge", 2, 5)],
      policy: DEFAULT_POLICY,
    });
    expect(r.eligible).toBe(false);
    expect(r.buildings.missing).toEqual(["bridge"]);
  });

  it("a final score under bronze gives no certificate even when everything is built", () => {
    const r = evaluateEligibility({
      requiredTasks: tasks,
      buildings: [building("grammar", 2, 4), building("bridge", 2, 5)],
      policy: { ...DEFAULT_POLICY, minBuildingLevel: 1 },
    });
    expect(r).toMatchObject({ eligible: false, finalScore: 4.5, tier: null });
  });

  it("needs at least one core building", () => {
    expect(evaluateEligibility({ requiredTasks: [], buildings: [], policy: DEFAULT_POLICY }).eligible).toBe(false);
  });

  it("formats serials", () => {
    expect(formatSerial(2026, 1)).toBe("SZ-2026-000001");
    expect(formatSerial(2027, 123456)).toBe("SZ-2027-123456");
  });
});
