"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const labels = { kk: "ҚАЗ", ru: "РУС" } as const;

/** ҚАЗ | РУС segmented toggle. Keeps the current path and stores the choice in the NEXT_LOCALE cookie. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("common");
  const current = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn("inline-flex rounded-full border border-line bg-cream p-[3px]", pending && "opacity-70", className)}
    >
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === current}
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              router.replace(pathname, { locale });
            })
          }
          className={cn(
            "cursor-pointer rounded-full px-3 py-1.5 text-[13px] font-extrabold text-ink-500",
            locale === current && "bg-surface text-fg shadow-[0_1px_3px_rgba(30,42,59,.15)]",
          )}
        >
          {labels[locale]}
        </button>
      ))}
    </div>
  );
}
