import { describe, expect, it } from "vitest";
import kk from "@/messages/kk.json";
import ru from "@/messages/ru.json";
import { navByRole, roles } from "@/components/shell/nav-config";

/** Flatten nested messages into dot-separated keys: { a: { b: "x" } } → ["a.b"]. */
function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === "object" ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("i18n messages", () => {
  it("kk and ru define exactly the same keys", () => {
    expect(keys(ru).sort()).toEqual(keys(kk).sort());
  });

  it("no message is empty", () => {
    for (const [name, dict] of Object.entries({ kk, ru })) {
      const flat = keys(dict).map((k) => [
        k,
        k.split(".").reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], dict),
      ]);
      const empty = flat.filter(([, v]) => typeof v !== "string" || v.trim() === "").map(([k]) => `${name}:${k}`);
      expect(empty).toEqual([]);
    }
  });

  it("every navigation item has a label in both languages", () => {
    const all = new Set([...keys(kk), ...keys(ru)]);
    for (const role of roles) {
      for (const item of navByRole[role]) {
        expect(all.has(`nav.${role}.${item.key}`), `nav.${role}.${item.key}`).toBe(true);
      }
    }
  });
});
