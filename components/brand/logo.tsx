import { cn } from "@/lib/utils";

/** Isometric "С" block with a golden roof — rendered once from design/iso/iso-engine.js. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-36 -46 72 82" aria-hidden="true" className={cn("size-10 shrink-0", className)}>
      <g stroke="rgba(30,42,59,0.30)" strokeWidth={1} strokeLinejoin="round">
        <polygon points="-32,16 0,32 0,1.4 -32,-14.6" fill="#00AFCA" />
        <polygon points="32,16 0,32 0,1.4 32,-14.6" fill="#0694ad" />
        <polygon points="0,-30.6 32,-14.6 0,1.4 -32,-14.6" fill="#38c1d6" />
      </g>
      <g transform="matrix(32,16,0,34,-32,-14.6)">
        <text
          x="0.5"
          y="0.45"
          fontSize="0.55"
          style={{ fontFamily: "var(--font-display)" }}
          fontWeight={800}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
        >
          С
        </text>
      </g>
      <g stroke="rgba(30,42,59,0.30)" strokeWidth={1} strokeLinejoin="round">
        <polygon points="0,-32.2 35.2,-14.6 0,-40.1" fill="#f4bf2d" />
        <polygon points="-35.2,-14.6 0,-32.2 0,-40.1" fill="#ffce45" />
        <polygon points="-35.2,-14.6 0,3 0,-40.1" fill="#FFC72C" />
        <polygon points="35.2,-14.6 0,3 0,-40.1" fill="#d2a82f" />
      </g>
    </svg>
  );
}

/** `compact`: show only the mark on phones (cabinet headers, where space is tight). */
export function Logo({
  name,
  tagline,
  compact = false,
  className,
}: {
  name: string;
  tagline?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className={cn("leading-tight", compact && "hidden sm:block")}>
        <span className="block font-display text-xl font-extrabold tracking-[0.02em]">{name}</span>
        {tagline && (
          <span className="hidden text-[11px] font-bold tracking-[0.08em] text-muted uppercase sm:block">
            {tagline}
          </span>
        )}
      </span>
    </span>
  );
}
