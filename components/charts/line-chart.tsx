"use client";

import { useEffect, useRef, useState } from "react";
import { CHART } from "./chart-tokens";

export type LinePoint = { x: string; value: number | null; detail?: string };

const H = 220;
const PAD = { top: 16, right: 36, bottom: 28, left: 32 };

/**
 * Single-series line (change over time): 2px line, 10% area wash, ≥8px dots
 * with a 2px surface ring, hairline gridlines, value labelled only at the end.
 * Crosshair + tooltip on hover; ←/→ keys move it when the chart has focus.
 * `null` values break the line (no data that week).
 */
export function LineChart({
  points,
  yMax,
  yTicks,
  label,
  format = (v) => String(v),
}: {
  points: LinePoint[];
  yMax: number;
  yTicks: number[];
  label: string;
  format?: (v: number) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const innerW = w - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.max(0, Math.min(yMax, v)) / yMax) * innerH;

  // Line segments split at null values.
  const segments: { i: number; v: number }[][] = [];
  let cur: { i: number; v: number }[] = [];
  points.forEach((p, i) => {
    if (p.value == null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else cur.push({ i, v: p.value });
  });
  if (cur.length) segments.push(cur);

  const lastIdx = [...points.keys()].reverse().find((i) => points[i].value != null);
  const showEvery = Math.ceil(n / Math.max(1, Math.floor(innerW / 64)));

  const pick = (clientX: number) => {
    const rect = box.current!.getBoundingClientRect();
    const rel = clientX - rect.left - PAD.left;
    const i = n <= 1 ? 0 : Math.round((rel / innerW) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, i)));
  };

  const ap = active != null ? points[active] : null;

  return (
    <div
      ref={box}
      className="relative w-full min-w-0 touch-pan-y select-none"
      tabIndex={0}
      role="img"
      aria-label={label}
      onPointerMove={(e) => pick(e.clientX)}
      onPointerDown={(e) => pick(e.clientX)}
      onPointerLeave={() => setActive(null)}
      onBlur={() => setActive(null)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
        if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? n) - 1));
      }}
    >
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${w} ${H}`}
        preserveAspectRatio="none"
        className="block overflow-visible"
        aria-hidden
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={w - PAD.right} y1={y(t)} y2={y(t)} stroke={CHART.grid} strokeWidth={1} />
            <text
              x={PAD.left - 8}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="central"
              fontSize={11}
              fill={CHART.axis}
              className="tabular-nums"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {points.map((p, i) =>
          i % showEvery === 0 || i === n - 1 ? (
            <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={11} fill={CHART.axis}>
              {p.x}
            </text>
          ) : null,
        )}

        {segments.map((seg, k) => {
          const line = seg.map((p, j) => `${j ? "L" : "M"}${x(p.i)},${y(p.v)}`).join("");
          const area = `${line}L${x(seg.at(-1)!.i)},${y(0)}L${x(seg[0].i)},${y(0)}Z`;
          return (
            <g key={k}>
              <path d={area} fill={CHART.wash} />
              <path
                d={line}
                fill="none"
                stroke={CHART.series}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          );
        })}

        {/* lone points (a week with data between two empty weeks) still show */}
        {segments
          .filter((s) => s.length === 1)
          .map((s) => (
            <circle
              key={s[0].i}
              cx={x(s[0].i)}
              cy={y(s[0].v)}
              r={4}
              fill={CHART.series}
              stroke={CHART.surface}
              strokeWidth={2}
            />
          ))}

        {lastIdx != null && (
          <>
            <circle
              cx={x(lastIdx)}
              cy={y(points[lastIdx].value!)}
              r={4}
              fill={CHART.series}
              stroke={CHART.surface}
              strokeWidth={2}
            />
            <text
              x={x(lastIdx) + 8}
              y={y(points[lastIdx].value!)}
              dominantBaseline="central"
              fontSize={12}
              fontWeight={800}
              fill="var(--color-text)"
            >
              {format(points[lastIdx].value!)}
            </text>
          </>
        )}

        {active != null && (
          <g>
            <line
              x1={x(active)}
              x2={x(active)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke={CHART.axis}
              strokeWidth={1}
            />
            {ap?.value != null && (
              <circle
                cx={x(active)}
                cy={y(ap.value)}
                r={5}
                fill={CHART.series}
                stroke={CHART.surface}
                strokeWidth={2}
              />
            )}
          </g>
        )}
      </svg>
      {ap && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 z-10 rounded-md bg-ink-900 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap text-white shadow-float"
          style={{ left: Math.min(Math.max(x(active!) - 60, 0), w - 140) }}
        >
          {ap.x}: {ap.value != null ? format(ap.value) : "—"}
          {ap.detail && <span className="block font-normal opacity-80">{ap.detail}</span>}
        </div>
      )}
    </div>
  );
}
