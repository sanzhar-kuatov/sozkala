"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { isActive, navByRole, type Role } from "./nav-config";

/** Desktop sidebar (lg+). */
export function SideNav({ role }: { role: Role }) {
  const t = useTranslations();
  const label = (key: string) => t(`nav.${role}.${key}` as Parameters<typeof t>[0]);
  const pathname = usePathname();
  return (
    <nav aria-label={t("common.menu")} className="sticky top-20 grid gap-1">
      {navByRole[role].map(({ href, key, icon: Icon }) => {
        const active = isActive(pathname, href, role);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-[15px] font-bold text-ink-700 transition-colors hover:bg-cream",
              active && "bg-surface text-fg shadow-card hover:bg-surface",
            )}
          >
            <span
              className={cn(
                "grid size-8 place-items-center rounded-[10px] bg-ink-100 text-ink-500",
                active && "bg-[var(--role)] text-white",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
            </span>
            {label(key)}
          </Link>
        );
      })}
    </nav>
  );
}

/** Phone/tablet bottom tab bar (< lg). Scrolls horizontally for roles with many sections. */
export function TabBar({ role }: { role: Role }) {
  const t = useTranslations();
  const label = (key: string) => t(`nav.${role}.${key}` as Parameters<typeof t>[0]);
  const pathname = usePathname();
  const items = navByRole[role];
  return (
    <nav
      aria-label={t("common.menu")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="flex [scrollbar-width:none] overflow-x-auto">
        {items.map(({ href, key, icon: Icon }) => {
          const active = isActive(pathname, href, role);
          return (
            <li key={href} className={cn("min-w-[76px] flex-1", items.length > 5 && "flex-none")}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-[11px] font-bold text-ink-500",
                  active && "text-fg",
                )}
              >
                <span
                  className={cn(
                    "grid h-7 w-11 place-items-center rounded-full transition-colors",
                    active && "bg-[var(--role)] text-white",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="max-w-full truncate">{label(key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
