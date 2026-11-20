import { describe, expect, it } from "vitest";
import { citySvg, renderCity } from "@/components/city/engine/buildings";
import { DECORATION_SLOTS, renderDecoration, slotIndexOf, toStored } from "@/components/city/engine/decorations";
import { meetsRule, rewardFor, type StudentProgress } from "@/lib/rewards/rules";
import { ACHIEVEMENTS, DECORATIONS } from "@/prisma/seed/reference";

describe("rewards (spec §6) are paid for improvement", () => {
  it("first attempt: 10 points per score point, stars at 9+", () => {
    expect(rewardFor({ score: 7, previousBest: null, levelsGained: 3 })).toEqual({
      points: 70,
      materials: 15,
      stars: 0,
    });
    expect(rewardFor({ score: 9.5, previousBest: null, levelsGained: 0 })).toEqual({
      points: 95,
      materials: 0,
      stars: 1,
    });
  });
  it("a retake pays only the improvement", () => {
    expect(rewardFor({ score: 9, previousBest: 7, levelsGained: 1 })).toEqual({ points: 20, materials: 5, stars: 1 });
  });
  it("a worse or equal retake pays nothing (no farming)", () => {
    expect(rewardFor({ score: 5, previousBest: 7, levelsGained: 0 })).toEqual({ points: 0, materials: 0, stars: 0 });
    expect(rewardFor({ score: 10, previousBest: 10, levelsGained: 0 })).toEqual({ points: 0, materials: 0, stars: 0 });
  });
  it("the star is given only once per task", () => {
    expect(rewardFor({ score: 10, previousBest: 9, levelsGained: 1 }).stars).toBe(0);
  });
});

describe("achievement rules", () => {
  const rule = (key: string) => ACHIEVEMENTS.find((a) => a.key === key)!.rule;
  const p = (levels: StudentProgress["levels"], results: StudentProgress["results"] = []): StudentProgress => ({
    levels,
    results,
  });

  it("«Сөз сәулетшісі»: the first building", () => {
    expect(meetsRule(rule("word_architect"), p({ grammar: 0 }))).toBe(false);
    expect(meetsRule(rule("word_architect"), p({ grammar: 1 }))).toBe(true);
  });
  it("«Емле шебері»: the palace at level 5", () => {
    expect(meetsRule(rule("spelling_master"), p({ grammar: 4 }))).toBe(false);
    expect(meetsRule(rule("spelling_master"), p({ grammar: 5 }))).toBe(true);
  });
  it("«Әдебиет зерттеушісі»: theatre and library at level 3", () => {
    expect(meetsRule(rule("literature_researcher"), p({ theatre: 3, library: 2 }))).toBe(false);
    expect(meetsRule(rule("literature_researcher"), p({ theatre: 3, library: 4 }))).toBe(true);
  });
  it("«Сөзқаланың бас сәулетшісі»: all 8 buildings at level 3", () => {
    const seven = { grammar: 3, bridge: 3, library: 3, theatre: 3, tower: 3, academy: 3, park: 3 };
    expect(meetsRule(rule("chief_architect"), p({ ...seven, townhall: 2 }))).toBe(false);
    expect(meetsRule(rule("chief_architect"), p({ ...seven, townhall: 3 }))).toBe(true);
  });
  it("perfect ten and improved retake", () => {
    expect(meetsRule(rule("perfect_ten"), p({}, [{ taskId: "a", score: 10 }]))).toBe(true);
    expect(
      meetsRule(
        rule("persistent_builder"),
        p({}, [
          { taskId: "a", score: 5 },
          { taskId: "a", score: 4 },
        ]),
      ),
    ).toBe(false);
    expect(
      meetsRule(
        rule("persistent_builder"),
        p({}, [
          { taskId: "a", score: 5 },
          { taskId: "a", score: 7 },
        ]),
      ),
    ).toBe(true);
  });
});

describe("decorations on the map", () => {
  it("40 unique slots on the streets", () => {
    expect(DECORATION_SLOTS).toHaveLength(40);
    expect(new Set(DECORATION_SLOTS.map((s) => `${s.x},${s.y}`)).size).toBe(40);
  });
  it("stored coordinates round-trip", () => {
    DECORATION_SLOTS.forEach((s, i) => {
      const { x, y } = toStored(s);
      expect(slotIndexOf(x, y)).toBe(i);
    });
  });
  it("every shop decoration renders", () => {
    for (const d of DECORATIONS) {
      const out = renderDecoration(d.key, DECORATION_SLOTS[0]);
      expect(out.length).toBeGreaterThan(20);
      expect(out).not.toMatch(/NaN|undefined/);
    }
  });
  it("placed decorations and placement markers appear in the city", () => {
    const deco = { id: "d1", key: "fountain", ...toStored(DECORATION_SLOTS[5]) };
    const out = citySvg({}, { decorations: [deco], editSlots: true });
    expect(out).toContain('data-deco="d1"');
    expect(out.match(/class="deco-slot"/g)).toHaveLength(39); // the taken slot has no marker
  });
  it("no decorations → exactly the original city", () => {
    expect(renderCity({ grammar: 3 }, { decorations: [] })).toBe(renderCity({ grammar: 3 }));
  });
});
