import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { TierSeal } from "@/components/certificates/certificate-status";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { verifyCertificate } from "@/lib/certificates/service";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("certificate.verify");
  // Never indexed: the code is a capability link.
  return { title: t("title"), robots: { index: false, follow: false } };
}

/**
 * Public certificate check (spec §7, acceptance #10). Shows ONLY validity,
 * serial, tier and issue date — no name, class or school (§7, §11).
 */
export default async function VerifyPage({ params }: PageProps<"/[locale]/verify/[code]">) {
  const { code } = await params;
  const [cert, t, tc, tb, format] = await Promise.all([
    verifyCertificate(decodeURIComponent(code)),
    getTranslations("certificate.verify"),
    getTranslations("certificate"),
    getTranslations("brand"),
    getFormatter(),
  ]);

  let body: React.ReactNode;
  if (!cert) {
    body = (
      <div className="grid justify-items-center gap-3 text-center" data-state="invalid">
        <span className="grid size-14 place-items-center rounded-lg bg-coral-100 text-coral-700">
          <ShieldX className="size-7" aria-hidden />
        </span>
        <h1 className="text-xl font-extrabold">{t("invalidTitle")}</h1>
        <p className="text-muted">{t("invalidBody")}</p>
      </div>
    );
  } else {
    body = (
      <div className="grid justify-items-center gap-4 text-center" data-state={cert.state}>
        {cert.state === "valid" ? (
          <p className="flex items-center gap-2 rounded-full bg-grass-100 px-4 py-1.5 font-extrabold text-grass-700">
            <ShieldCheck className="size-5" aria-hidden />
            {t("valid")}
          </p>
        ) : cert.state === "revoked" ? (
          <p className="flex items-center gap-2 rounded-full bg-coral-100 px-4 py-1.5 font-extrabold text-coral-700">
            <ShieldX className="size-5" aria-hidden />
            {t("revoked")}
          </p>
        ) : (
          <p className="flex items-center gap-2 rounded-full bg-sun-100 px-4 py-1.5 font-extrabold text-sun-700">
            <ShieldAlert className="size-5" aria-hidden />
            {t("replaced")}
          </p>
        )}
        <TierSeal tier={cert.tier} label={tc(`tiers.${cert.tier}`)} size={96} />
        <h1 className="font-display text-2xl font-extrabold">{t("heading")}</h1>
        <dl className="grid w-full grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-left">
          <dt className="font-bold text-muted">{t("serial")}</dt>
          <dd className="font-extrabold tabular-nums">{cert.serial}</dd>
          <dt className="font-bold text-muted">{t("tier")}</dt>
          <dd className="font-extrabold">{tc(`tiers.${cert.tier}`)}</dd>
          <dt className="font-bold text-muted">{tc("issued")}</dt>
          <dd className="font-extrabold tabular-nums">
            {format.dateTime(cert.issuedAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
          </dd>
        </dl>
        {cert.state !== "valid" && (
          <p className="text-sm text-muted">{t(cert.state === "revoked" ? "revokedBody" : "replacedBody")}</p>
        )}
        <p className="text-xs text-muted">{t("privacy")}</p>
      </div>
    );
  }

  return (
    <main id="main" className="sky-gradient grid min-h-dvh place-items-center px-4 py-10">
      <div className="grid w-full max-w-[480px] gap-5">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-fg no-underline">
            <Logo name={tb("name")} />
          </Link>
          <LocaleSwitcher />
        </div>
        <Card className="grid gap-5 p-6">{body}</Card>
      </div>
    </main>
  );
}
