/**
 * City decorations (spec §6: tree, flower, road, bench, lamp, fountain).
 * Purely cosmetic — they never change scores or completion.
 *
 * The map is 3×3 plots separated by 1-unit roads, so decorations go on fixed
 * slots along the streets: the 24 midpoints of road segments (a "boulevard")
 * and the 16 crossings (where a fountain becomes a roundabout).
 * Slots are stored in the DB as doubled integer coordinates (CityDecoration.x/y).
 */
import { bench, DEFS, flat, flowers, fountain, lamp, svg, tree } from "./iso";

export type Slot = { x: number; y: number };

/** All 40 slots in world coordinates. */
export const DECORATION_SLOTS: Slot[] = (() => {
  const slots: Slot[] = [];
  const lines = [0, 1, 2, 3].map((k) => k * 4 + 0.5); // road centre lines
  const mids = [0, 1, 2].map((c) => 1 + c * 4 + 1.5); // plot centres
  for (const y of lines) for (const x of lines) slots.push({ x, y }); // crossings
  for (const y of lines) for (const x of mids) slots.push({ x, y }); // horizontal streets
  for (const x of lines) for (const y of mids) slots.push({ x, y }); // vertical streets
  return slots;
})();

/** DB form (doubled integers) ⇄ world coordinates. */
export const toStored = (s: Slot) => ({ x: Math.round(s.x * 2), y: Math.round(s.y * 2) });
export const slotIndexOf = (x: number, y: number) =>
  DECORATION_SLOTS.findIndex((s) => Math.round(s.x * 2) === x && Math.round(s.y * 2) === y);

const Z = 0.003; // just above the road surface

/** SVG of one decoration at a slot. Unknown keys render nothing. */
export function renderDecoration(key: string, s: Slot): string {
  switch (key) {
    case "tree_round":
      return tree(s.x, s.y, Z, 0.85);
    case "tree_pine":
      return tree(s.x, s.y, Z, 0.85, "pine");
    case "flower_bed":
      return flowers(s.x, s.y, Z);
    case "road_tile":
      return flat(s.x - 0.35, s.y - 0.35, s.x + 0.35, s.y + 0.35, Z, "#EADBC0", { stroke: "#D6C3A1", sw: 1 });
    case "bench":
      return bench(s.x - 0.2, s.y - 0.06, Z);
    case "lamp":
      return lamp(s.x, s.y, Z, true);
    case "fountain":
      return fountain(s.x, s.y, Z, 0.32);
    default:
      return "";
  }
}

export type PlacedDecoration = { id: string; key: string; x: number; y: number };

/** Small standalone picture of a decoration (shop, inventory). */
export function decorationPreviewSvg(key: string, label: string) {
  return svg("-24 -42 48 54", DEFS + renderDecoration(key, { x: 0, y: 0 }), { label, cls: "iso-svg" });
}
