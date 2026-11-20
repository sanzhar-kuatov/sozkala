import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const chipVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[13px] font-extrabold [&_svg]:size-[15px]",
  {
    variants: {
      tone: {
        neutral: "bg-ink-100 text-ink-700",
        student: "bg-sky-100 text-sky-700",
        teacher: "bg-[#D6F3E3] text-[#1D7A48]",
        parent: "bg-[#FFE5D3] text-[#B85314]",
        admin: "bg-[#E3E8EF] text-[#3F4D61]",
        auto: "bg-grass-100 text-grass-700",
        manual: "bg-violet-100 text-violet-700",
        warning: "bg-sun-100 text-sun-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Chip({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof chipVariants>) {
  return <span className={cn(chipVariants({ tone }), className)} {...props} />;
}
