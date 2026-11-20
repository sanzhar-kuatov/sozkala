import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Chunky game button with a 3D edge (design system §Components → Button).
 * Use `buttonVariants()` to style a <Link> the same way.
 */
export const buttonVariants = cva(
  "btn-3d inline-flex cursor-pointer items-center justify-center gap-2 font-extrabold whitespace-nowrap no-underline select-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "",
        accent: "[--b:var(--color-accent)] [--edge:var(--color-accent-edge)] [--fg:var(--sz-ink-900)]",
        success: "[--b:var(--color-success)] [--edge:var(--sz-grass-700)]",
        danger: "[--b:var(--color-danger)] [--edge:var(--sz-coral-700)]",
        ghost: "border-2 border-ink-100 [--b:var(--color-surface)] [--edge:var(--sz-ink-100)] [--fg:var(--color-text)]",
      },
      size: {
        sm: "min-h-9 rounded-[11px] px-3.5 py-1.5 text-[13px] [--depth:3px]",
        md: "min-h-11 rounded-md px-5 py-2.5 text-[15px]",
        lg: "min-h-14 rounded-lg px-7 py-3.5 text-[17px]",
        icon: "size-11 rounded-md p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export type ButtonProps = ComponentProps<"button"> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, size, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
