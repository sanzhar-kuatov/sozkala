"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { CHART } from "./chart-tokens";

export type BarItem = { label: string; value: number; display: string; detail?: string };

/**
 * Horizontal bars (magnitude, single series): 12px thick, 4px rounded data-end,
 * square at the baseline, value at the tip in ink. Hover or focus shows the detail.
 */
export function BarList({ items, max, label }: { items: BarItem[]; max: number; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <ul className="grid gap-2.5" aria-label={label}>
      {items.map((item, i) => {
        const pct = max > 0 ? Math.max(0, Math.min(100, (item.value / max) * 100)) : 0;
        return (
          <li
            key={item.label + i}
            tabIndex={0}
            aria-label={`${item.label}: ${item.display}${item.detail ? `, ${item.detail}` : ""}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative grid grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-md py-1 outline-offset-2 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]"
          >
            <span className="truncate text-sm font-semibold text-ink-700" title={item.label}>
              {item.label}
            </span>
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-3 min-w-0.5 rounded-r-[4px] transition-[width] duration-500"
                style={{ width: `calc(${pct}% - 3rem)`, background: CHART.series }}
                aria-hidden
              />
              <span className="shrink-0 text-sm font-extrabold text-fg tabular-nums">{item.display}</span>
            </span>
            {active === i && item.detail && (
              <span
                role="tooltip"
                className={cn(
                  "pointer-events-none absolute right-0 bottom-full z-10 mb-1 rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-float",
                )}
              >
                {item.label} · {item.display} · {item.detail}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
