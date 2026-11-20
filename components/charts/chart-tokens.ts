/**
 * Chart roles (dataviz method). Marks use --sz-sky-600 (#0096AE): it passed the
 * palette validator on the white card surface (contrast ≥ 3:1, chroma floor),
 * unlike the lighter brand sky-500 (2.6:1) or sky-700 (reads gray).
 * Text never wears the series colour — it stays in the ink tokens.
 */
export const CHART = {
  series: "var(--sz-sky-600)",
  wash: "color-mix(in srgb, var(--sz-sky-600) 10%, transparent)",
  grid: "var(--sz-ink-100)",
  axis: "var(--sz-ink-500)",
  surface: "var(--color-surface)",
} as const;
