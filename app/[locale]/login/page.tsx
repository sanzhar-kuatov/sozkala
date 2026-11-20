import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Card } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { homeFor, safeNextPath } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/guards";
import { InviteForm } from "./invite-form";
import { LoginForm, type DemoAccount } from "./login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

/** One-click demo logins, shown only outside production (seeded by prisma/seed/demo.ts). */
const DEMO_ACCOUNTS: DemoAccount[] =
  process.env.NODE_ENV === "production"
    ? []
    : [
        { login: "aruzhan", password: "demo12345", role: "student", name: "Аружан" },
        { login: "timur", password: "demo12345", role: "student", name: "Тимур" },
        { login: "teacher", password: "demo12345", role: "teacher", name: "Гүлмира Ахметова" },
        { login: "parent", password: "demo12345", role: "parent", name: "Сәуле Қасымова" },
        { login: "admin", password: "admin12345", role: "admin", name: "admin" },
      ];

export default async function LoginPage({ searchParams }: PageProps<"/[locale]/login">) {
  const t = await getTranslations();
  const next = (await searchParams).next;
  const nextPath = typeof next === "string" ? next : undefined;

  // Already signed in (checked against the database, not just the cookie).
  const user = await getCurrentUser();
  if (user) {
    redirect({ href: nextPath ? safeNextPath(nextPath, user.role) : homeFor(user.role), locale: await getLocale() });
  }

  return (
    <main id="main" className="sky-gradient grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-[420px] gap-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-fg no-underline">
            <Logo name={t("brand.name")} />
          </Link>
          <LocaleSwitcher />
        </div>

        <Card className="grid gap-5 p-6">
          <div>
            <h1 className="text-2xl font-extrabold">{t("login.title")}</h1>
            <p className="mt-1 text-muted">{t("login.subtitle")}</p>
          </div>
          <LoginForm next={nextPath} demoAccounts={DEMO_ACCOUNTS} />
        </Card>

        <Card tone="tint">
          <InviteForm />
        </Card>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 justify-self-center text-sm font-bold text-primary-edge"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("common.backHome")}
        </Link>
        <Link href="/privacy" className="justify-self-center text-xs font-bold text-muted">
          {t("privacy.link")}
        </Link>
      </div>
    </main>
  );
}
