import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  tone = "default",
  ...props
}: ComponentProps<"div"> & { tone?: "default" | "flat" | "tint" }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-5",
        tone === "default" && "shadow-card",
        tone === "tint" && "bg-cream",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<"h3">) {
  return <h3 className={cn("mb-1.5 text-lg font-bold", className)} {...props} />;
}
