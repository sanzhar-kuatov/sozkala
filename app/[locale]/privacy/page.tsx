import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { PRIVACY_VERSION } from "@/lib/privacy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title") };
}

/** Public personal-data notice (spec §11; Law of the RK No. 94-V). Linked from login, registration and the landing page. */
export default async function PrivacyPage() {
  const t = await getTranslations();
  const sections = t.raw("privacy.sections") as { h: string; p: string }[];
  return (
    <main id="main" className="sky-gradient min-h-dvh px-4 py-10">
      <div className="mx-auto grid w-full max-w-[720px] gap-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-fg no-underline">
            <Logo name={t("brand.name")} />
          </Link>
          <LocaleSwitcher />
        </div>
        <Card className="grid gap-4 p-6">
          <div>
            <h1 className="text-2xl font-extrabold">{t("privacy.title")}</h1>
            <p className="text-sm text-muted">{t("privacy.updated", { version: PRIVACY_VERSION })}</p>
          </div>
          <p>{t("privacy.intro")}</p>
          {sections.map((s) => (
            <section key={s.h} className="grid gap-1">
              <h2 className="text-lg font-bold">{s.h}</h2>
              <p className="text-ink-700">{s.p}</p>
            </section>
          ))}
        </Card>
      </div>
    </main>
  );
}
