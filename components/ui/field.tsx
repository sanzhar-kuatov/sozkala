import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

const inputClass =
  "min-h-12 w-full rounded-md border-2 border-ink-100 bg-surface px-3.5 py-3 text-base font-semibold text-fg transition-colors placeholder:text-ink-300 focus:border-primary focus:shadow-[0_0_0_4px_var(--sz-sky-100)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(inputClass, "min-h-28", className)} {...props} />;
}

/** id of the hint/error paragraph for a field — pass it to the control's `aria-describedby`. */
export const hintId = (id: string) => `${id}-hint`;

/**
 * Label + control + hint/error. Give the control the same `id`, plus
 * `aria-describedby={hintId(id)}` and `aria-invalid` when there is an error.
 */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
}) {
  const message = error ?? hint;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-extrabold">
        {label}
      </label>
      {children}
      {message && (
        <p id={hintId(id)} className={cn("text-[13px]", error ? "font-bold text-coral-700" : "text-muted")}>
          {message}
        </p>
      )}
    </div>
  );
}
