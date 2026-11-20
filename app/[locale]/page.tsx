import { ArrowRight, Hammer, Landmark, LogIn, Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { citySvg } from "@/components/city/engine/buildings";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { roleHome, roleIcon, roles } from "@/components/shell/nav-config";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { getCurrentUser } from "@/lib/auth/guards";
import { homeFor } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const HERO_CITY = citySvg(
  { grammar: 5, bridge: 4, library: 3, theatre: 4, tower: 5, academy: 2, park: 3, townhall: 4 },
  { cityName: "СӨЗҚАЛА" },
);

const roleBody = {
  student: "studentBody",
  teacher: "teacherBody",
  parent: "parentBody",
  admin: "adminBody",
} as const;

export default async function LandingPage() {
  const t = await getTranslations();
  const user = await getCurrentUser();
  const cta = user
    ? { href: homeFor(user.role), label: t("common.openCabinet") }
    : { href: "/login", label: t("common.login") };

  const features = [
    { icon: Landmark, title: t("landing.f1Title"), body: t("landing.f1Body"), tint: "bg-sky-100 text-sky-700" },
    { icon: Sparkles, title: t("landing.f2Title"), body: t("landing.f2Body"), tint: "bg-violet-100 text-violet-700" },
    { icon: Hammer, title: t("landing.f3Title"), body: t("landing.f3Body"), tint: "bg-grass-100 text-grass-700" },
  ];

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4">
          <Logo name={t("brand.name")} tagline={t("brand.tagline")} />
          <div className="ml-auto flex items-center gap-2">
            <LocaleSwitcher />
            <Link href={cta.href} className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
              <LogIn aria-hidden />
              {cta.label}
            </Link>
          </div>
        </div>
      </header>

      <main id="main">
        <section className="sky-gradient">
          <div className="mx-auto grid max-w-[1240px] items-center gap-6 px-4 pt-8 pb-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:pt-14">
            <div>
              <Chip tone="student">{t("landing.kicker")}</Chip>
              <h1 className="mt-4 text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold">
                {t("landing.title1")} <span className="text-primary">{t("landing.title2")}</span>
              </h1>
              <p className="mt-4 max-w-[520px] text-lg text-ink-700">{t("landing.lead")}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={cta.href} className={buttonVariants({ size: "lg", variant: "accent" })}>
                  <LogIn aria-hidden />
                  {user ? cta.label : t("landing.cta")}
                </Link>
              </div>
            </div>
            {/* Decorative sample city, drawn live by the same engine as the students' cities. */}
            <div
              aria-hidden
              className="city-host pointer-events-none drop-shadow-[0_24px_30px_rgba(30,42,59,.18)]"
              dangerouslySetInnerHTML={{ __html: HERO_CITY }}
            />
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 py-12">
          <h2 className="mb-6 text-2xl font-extrabold">{t("landing.featuresTitle")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, body, tint }) => (
              <Card key={title}>
                <span className={cn("mb-3 grid size-12 place-items-center rounded-md", tint)}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <CardTitle>{title}</CardTitle>
                <p className="text-muted">{body}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-4 pb-16">
          <h2 className="mb-6 text-2xl font-extrabold">{t("landing.rolesTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {roles.map((role) => {
              const Icon = roleIcon[role];
              return (
                <Card
                  key={role}
                  className="flex flex-col gap-3 border-t-4"
                  style={{ borderTopColor: `var(--role-${role})` }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-11 place-items-center rounded-md text-white"
                      style={{ background: `var(--role-${role})` }}
                    >
                      <Icon className="size-6" aria-hidden />
                    </span>
                    <CardTitle className="mb-0">{t(`roles.${role}`)}</CardTitle>
                  </div>
                  <p className="flex-1 text-muted">{t(`landing.${roleBody[role]}`)}</p>
                  <Link href={roleHome(role)} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                    {t("landing.open")}
                    <ArrowRight aria-hidden />
                  </Link>
                </Card>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-dashed border-line py-6 text-center text-sm text-muted">
        © {t("brand.name")} · {t("brand.tagline")} ·{" "}
        <Link href="/privacy" className="font-bold text-primary-edge">
          {t("privacy.link")}
        </Link>
      </footer>
    </>
  );
}
