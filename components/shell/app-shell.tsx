import { Bell, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { CSSProperties, ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { logout } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/session";
import { unreadCount } from "@/lib/notifications-feed";
import { LocaleSwitcher } from "./locale-switcher";
import { roleHome, type Role } from "./nav-config";
import { SideNav, TabBar } from "./role-nav";

/**
 * Cabinet layout shared by all four roles: a top bar with the role accent stripe,
 * a sidebar on desktop and a bottom tab bar on phones (docs/design/03-ux-wireframes.md).
 */
export async function AppShell({ role, user, children }: { role: Role; user: SessionUser; children: ReactNode }) {
  const t = await getTranslations();
  const unread = role === "admin" ? 0 : await unreadCount(user);
  const roleStyle = { "--role": `var(--role-${role})` } as CSSProperties;
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();

  return (
    <div style={roleStyle} className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:shadow-float"
      >
        {t("common.skipToContent")}
      </a>

      <header className="sticky top-0 z-20 border-t-4 border-b border-[var(--role)] border-b-line bg-paper/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4">
          <Link href={roleHome(role)} className="text-fg no-underline">
            <Logo name={t("brand.name")} compact />
          </Link>
          <Chip tone={role} className="hidden sm:inline-flex">
            {t(`roles.${role}`)}
          </Chip>
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            {role !== "admin" && (
              <Link
                href={`/${role}/notifications`}
                aria-label={t("notifications.bell", { count: unread })}
                title={t("notifications.title")}
                className="relative grid size-10 place-items-center rounded-full text-ink-700 hover:bg-cream"
              >
                <Bell className="size-5" aria-hidden />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[11px] leading-5 font-extrabold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            )}
            <div className="flex items-center gap-2 border-l border-line pl-2">
              <Link
                href="/account"
                title={t("account.title")}
                aria-label={`${t("account.title")}: ${user.firstName} ${user.lastName}`}
                className="flex items-center gap-2 rounded-full text-fg no-underline hover:bg-cream"
              >
                <span
                  className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--role)] font-display text-sm font-extrabold text-white"
                  aria-hidden
                >
                  {initials}
                </span>
                <span className="hidden max-w-40 truncate text-sm leading-tight font-bold md:block">
                  <span className="sr-only">{t("common.signedInAs")} </span>
                  {user.firstName} {user.lastName}
                </span>
              </Link>
              <form action={logout}>
                <button
                  type="submit"
                  className="grid size-10 cursor-pointer place-items-center rounded-full text-ink-500 transition-colors hover:bg-cream hover:text-fg"
                  aria-label={t("common.logout")}
                  title={t("common.logout")}
                >
                  <LogOut className="size-5" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1440px] gap-6 px-4 pt-4 pb-28 lg:grid-cols-[240px_minmax(0,1fr)] lg:pb-10">
        <aside className="hidden lg:block">
          <SideNav role={role} />
        </aside>
        <main id="main" className="min-w-0">
          {children}
        </main>
      </div>

      <TabBar role={role} />
    </div>
  );
}
