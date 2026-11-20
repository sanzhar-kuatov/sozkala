import { cn } from "@/lib/utils";

/** Striped progress bar (city completion, task progress). `value` is 0–100. */
export function Progress({
  value,
  tone = "sun",
  label,
  className,
}: {
  value: number;
  tone?: "sun" | "sky";
  label: string;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      className={cn("h-3.5 overflow-hidden rounded-full bg-ink-100", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-[600ms] ease-out",
          tone === "sun" ? "progress-stripes" : "progress-stripes-sky",
        )}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
