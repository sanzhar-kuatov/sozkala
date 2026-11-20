"use client";

import { useState } from "react";
import { CHART } from "./chart-tokens";

export type Column = { x: string; value: number; detail?: string };

/**
 * Counts per period: columns ≤ 24px wide with a 4px rounded cap, square on the
 * baseline. Only the latest and the highest column are labelled; hover / focus
 * shows the rest (and the table view has every value).
 */
export function ColumnChart({ columns, label }: { columns: Column[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...columns.map((c) => c.value));
  const maxIdx = columns.findIndex((c) => c.value === max);
  const last = columns.length - 1;

  return (
    <div role="group" aria-label={label} className="grid gap-1">
      <div className="flex h-40 items-end gap-0.5 border-b border-ink-100">
        {columns.map((c, i) => (
          <div
            key={c.x + i}
            tabIndex={0}
            aria-label={`${c.x}: ${c.value}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative flex h-full flex-1 flex-col items-center justify-end rounded-sm outline-offset-2"
          >
            {(i === last || i === maxIdx || active === i) && c.value > 0 && (
              <span className="mb-1 text-xs font-extrabold text-fg tabular-nums">{c.value}</span>
            )}
            <span
              aria-hidden
              className="w-full max-w-6 rounded-t-[4px]"
              style={{ height: `${(c.value / max) * 85}%`, minHeight: c.value > 0 ? 2 : 0, background: CHART.series }}
            />
            {active === i && c.detail && (
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-float"
              >
                {c.detail}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-0.5">
        {columns.map((c, i) => (
          <span key={c.x + i} className="flex-1 truncate text-center text-[11px] text-ink-500">
            {c.x}
          </span>
        ))}
      </div>
    </div>
  );
}
