import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Native <select> styled like Input (works with keyboards, screen readers and phones). */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "min-h-12 w-full rounded-md border-2 border-ink-100 bg-surface px-3 text-base font-semibold text-fg focus:border-primary focus:shadow-[0_0_0_4px_var(--sz-sky-100)] focus:outline-none disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}

/** Checkbox with a label, sized for touch. */
export function Checkbox({ label, className, ...props }: ComponentProps<"input"> & { label: React.ReactNode }) {
  return (
    <label className={cn("inline-flex min-h-11 cursor-pointer items-center gap-2.5 font-semibold", className)}>
      <input type="checkbox" className="size-5 accent-(--color-primary)" {...props} />
      {label}
    </label>
  );
}
