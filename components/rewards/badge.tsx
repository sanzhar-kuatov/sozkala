import { BookOpenText, Crown, Hammer, Lock, PencilRuler, Sparkles, SpellCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "pencil-ruler": PencilRuler,
  "spell-check": SpellCheck,
  "book-open-text": BookOpenText,
  crown: Crown,
  sparkles: Sparkles,
  hammer: Hammer,
};
const COLORS: Record<string, [string, string]> = {
  sky: ["var(--sz-sky-500)", "var(--sz-sky-700)"],
  violet: ["var(--sz-violet-500)", "var(--sz-violet-700)"],
  grass: ["var(--sz-grass-500)", "var(--sz-grass-700)"],
  sun: ["var(--sz-sun-500)", "var(--sz-sun-700)"],
  coral: ["var(--sz-coral-500)", "var(--sz-coral-700)"],
};

/** Round "medal" with a 3D edge (design system: .badge-medal). */
export function BadgeMedal({
  icon,
  color,
  locked,
  size = "md",
}: {
  icon: string;
  color: string;
  locked?: boolean;
  size?: "sm" | "md";
}) {
  const Icon = locked ? Lock : (ICONS[icon] ?? Sparkles);
  const [face, edge] = locked ? ["var(--sz-ink-100)", "var(--sz-ink-300)"] : (COLORS[color] ?? COLORS.sky);
  return (
    <span
      aria-hidden
      className={cn(
        "grid place-items-center rounded-full",
        size === "md" ? "size-16" : "size-10",
        locked ? "text-ink-500" : "text-white",
      )}
      style={{ background: face, boxShadow: `0 4px 0 ${edge}` }}
    >
      <Icon className={size === "md" ? "size-8" : "size-5"} />
    </span>
  );
}
