import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { BUILDING_KEYS, citySvg, renderCity, renderPlot } from "@/components/city/engine/buildings";
import { esc } from "@/components/city/engine/iso";

/** The Stage 0 prototype (design/iso/*.js), loaded in a sandbox as the reference. */
function loadPrototype() {
  const sandbox: Record<string, unknown> = {};
  sandbox.window = sandbox;
  for (const f of ["design/iso/iso-engine.js", "design/iso/buildings.js"]) {
    runInNewContext(readFileSync(f, "utf8"), sandbox);
  }
  return sandbox.SozqalaCity as {
    renderPlot: (key: string, level: number, opts?: object) => string;
    renderCity: (levels: object, opts?: object) => string;
  };
}

const proto = loadPrototype();

describe("TypeScript city engine = Stage 0 prototype", () => {
  for (const key of BUILDING_KEYS) {
    it(`${key}: all 6 levels render identically`, () => {
      for (let level = 0; level <= 5; level++) {
        expect(renderPlot(key, level)).toBe(proto.renderPlot(key, level));
      }
    });
  }

  it("build animation markup is identical", () => {
    expect(renderPlot("grammar", 4, { animate: true })).toBe(proto.renderPlot("grammar", 4, { animate: true }));
  });

  it("the whole city is identical", () => {
    const levels = { grammar: 3, bridge: 1, library: 2, theatre: 3, tower: 4, academy: 0, park: 5, townhall: 0 };
    expect(renderCity(levels, { cityName: "Аружан-қала", animateKey: "tower" })).toBe(
      proto.renderCity(levels, { cityName: "Аружан-қала", animateKey: "tower" }),
    );
  });
});

describe("safety", () => {
  it("escapes the student-chosen city name (no SVG/HTML injection)", () => {
    const out = citySvg({}, { cityName: `<script>alert(1)</script>"&` });
    expect(out).not.toContain("<script>");
    expect(out).toContain(esc(`<script>alert(1)</script>"&`));
  });

  it("produces no NaN/undefined for any level", () => {
    for (const key of BUILDING_KEYS)
      for (let level = 0; level <= 5; level++) expect(renderPlot(key, level)).not.toMatch(/NaN|undefined/);
  });
});
