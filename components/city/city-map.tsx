"use client";

import { Minus, Plus, Scan } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import type { BuildingKey } from "@/lib/domain/buildings";
import { cn } from "@/lib/utils";
import { citySvg, SQUARE_KEY, type CityLevels } from "./engine/buildings";
import type { PlacedDecoration } from "./engine/decorations";

type Props = {
  levels: CityLevels;
  cityName: string;
  /** building that plays the build/upgrade animation */
  animateKey?: BuildingKey | null;
  selected?: BuildingKey | null;
  onSelect?: (key: BuildingKey) => void;
  labels: { map: string; zoomIn: string; zoomOut: string; zoomReset: string };
  className?: string;
  /** placed decorations (cosmetic, spec §6) */
  decorations?: PlacedDecoration[];
  /** decoration placement mode: free slots become clickable */
  editSlots?: boolean;
  onSlot?: (slot: number) => void;
  onDecoration?: (id: string) => void;
};

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

/**
 * Interactive isometric city: wheel / pinch zoom (1–3×), drag to pan when zoomed,
 * click / Enter / Space on a plot selects it. The SVG comes from the pure engine
 * (components/city/engine) and is injected as markup; the only user text in it
 * (the city name) is XML-escaped by the engine.
 */
export function CityMap({
  levels,
  cityName,
  animateKey,
  selected,
  onSelect,
  labels,
  className,
  decorations,
  editSlots,
  onSlot,
  onDecoration,
}: Props) {
  const viewRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const view = useRef({ x: 0, y: 0, s: 1 });
  const moved = useRef(0);

  const markup = useMemo(
    () => citySvg(levels, { cityName, animateKey, decorations, editSlots }),
    [levels, cityName, animateKey, decorations, editSlots],
  );

  const svgEl = () => hostRef.current?.querySelector("svg") ?? null;
  const apply = () => {
    const s = svgEl();
    if (s) s.style.transform = `translate(${view.current.x}px,${view.current.y}px) scale(${view.current.s})`;
  };
  const clampPan = () => {
    const el = viewRef.current;
    if (!el) return;
    const { s } = view.current;
    const w = el.clientWidth;
    const h = el.clientHeight;
    view.current.x = Math.min(0, Math.max(w - w * s, view.current.x));
    view.current.y = Math.min(0, Math.max(h - h * s, view.current.y));
  };
  const zoomAt = (factor: number, cx: number, cy: number) => {
    const v = view.current;
    const ns = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, v.s * factor));
    const k = ns / v.s;
    v.x = cx - (cx - v.x) * k;
    v.y = cy - (cy - v.y) * k;
    v.s = ns;
    if (ns === MIN_ZOOM) {
      v.x = 0;
      v.y = 0;
    }
    clampPan();
    apply();
  };
  const zoomCenter = (factor: number) => {
    const el = viewRef.current;
    if (el) zoomAt(factor, el.clientWidth / 2, el.clientHeight / 2);
  };
  const reset = () => {
    view.current = { x: 0, y: 0, s: 1 };
    apply();
  };

  // New SVG element after an animation change → re-apply the current pan/zoom.
  useEffect(apply, [markup]);

  // Highlight the selected plot.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.querySelectorAll(".plot.is-selected").forEach((p) => p.classList.remove("is-selected"));
    if (selected) host.querySelector(`.plot[data-key="${selected}"]`)?.classList.add("is-selected");
  }, [selected, markup]);

  // Wheel zoom (needs a non-passive listener to prevent page scroll).
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers only use refs
  }, []);

  // Drag to pan + two-finger pinch.
  const pointers = useRef(new Map<number, [number, number]>());
  const pinch = useRef(0);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("button")) return;
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    moved.current = 0;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a[0] - b[0], a[1] - b[1]);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      const r = viewRef.current!.getBoundingClientRect();
      if (pinch.current) zoomAt(d / pinch.current, (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top);
      pinch.current = d;
      moved.current = 99;
      return;
    }
    if (view.current.s > 1) {
      view.current.x += e.clientX - prev[0];
      view.current.y += e.clientY - prev[1];
      clampPan();
      apply();
    }
    moved.current += Math.abs(e.clientX - prev[0]) + Math.abs(e.clientY - prev[1]);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = 0;
  };

  const pick = (target: EventTarget | null) => {
    const el = target as Element | null;
    const slot = el?.closest?.(".deco-slot") as HTMLElement | null;
    if (slot && onSlot) return onSlot(Number(slot.dataset.slot));
    const deco = el?.closest?.(".deco") as HTMLElement | null;
    if (deco && onDecoration) return onDecoration(deco.dataset.deco!);
    const plot = el?.closest?.(".plot") as HTMLElement | null;
    const key = plot?.dataset.key;
    if (key && key !== SQUARE_KEY) onSelect?.(key as BuildingKey);
  };

  return (
    <div
      ref={viewRef}
      className={cn(
        "sky-gradient relative touch-none overflow-hidden rounded-xl border border-line select-none",
        className,
      )}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        ref={hostRef}
        role="group"
        aria-label={labels.map}
        className="city-host"
        onClick={(e) => {
          if (moved.current <= 6) pick(e.target);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          pick(e.target);
        }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
      <div className="absolute right-3 bottom-3 grid gap-1.5">
        <ZoomButton label={labels.zoomIn} icon={Plus} onClick={() => zoomCenter(1.3)} />
        <ZoomButton label={labels.zoomOut} icon={Minus} onClick={() => zoomCenter(1 / 1.3)} />
        <ZoomButton label={labels.zoomReset} icon={Scan} onClick={reset} />
      </div>
    </div>
  );
}

function ZoomButton({ label, icon: Icon, onClick }: { label: string; icon: typeof Plus; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 cursor-pointer place-items-center rounded-[12px] border border-line bg-surface text-ink-700 shadow-card hover:bg-cream"
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
