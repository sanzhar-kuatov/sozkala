import { CircleCheck, CircleDashed, Download, ShieldCheck } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { TIER_COLOR, TIERS, type Tier } from "@/lib/certificates/rules";
import type { CertificateView } from "@/lib/certificates/service";
import { BUILDINGS } from "@/lib/domain/buildings";
import { cn } from "@/lib/utils";

/** Round medal in the tier colour (bronze / silver / gold / platinum). */
export function TierSeal({ tier, label, size = 72 }: { tier: Tier; label: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 72 72" role="img" aria-label={label} className="shrink-0">
      <path d="M22 50 14 70l10-4 6 8 6-20Z" fill={TIER_COLOR[tier]} opacity=".75" />
      <path d="M50 50l8 20-10-4-6 8-6-20Z" fill={TIER_COLOR[tier]} opacity=".75" />
      <circle cx="36" cy="32" r="28" fill={TIER_COLOR[tier]} />
      <circle cx="36" cy="32" r="22" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M36 18l4.1 8.4 9.2 1.3-6.7 6.5 1.6 9.2L36 39l-8.2 4.4 1.6-9.2-6.7-6.5 9.2-1.3Z" fill="#fff" />
    </svg>
  );
}

/**
 * Certificate status (wireframe §3.6): the requirements checklist, then the
 * issued certificate with PDF downloads (kk / ru) and the public verify link.
 */
export async function CertificateStatus({ view, compact = false }: { view: CertificateView; compact?: boolean }) {
  const t = await getTranslations("certificate");
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";
  const { result, policy, certificate } = view;
  const bName = (key: string) => BUILDINGS.find((b) => b.key === key)?.name[locale] ?? key;

  const checks = [
    {
      ok: result.tasks.total > 0 && result.tasks.done === result.tasks.total,
      label: t("checkTasks", { done: result.tasks.done, total: result.tasks.total }),
      value: result.tasks.total ? (result.tasks.done / result.tasks.total) * 100 : 0,
      missing: result.tasks.missing,
    },
    {
      ok: result.buildings.total > 0 && result.buildings.built === result.buildings.total,
      label: t("checkBuildings", {
        built: result.buildings.built,
        total: result.buildings.total,
        level: policy.minBuildingLevel,
      }),
      value: result.buildings.total ? (result.buildings.built / result.buildings.total) * 100 : 0,
      missing: result.buildings.missing.map(bName),
    },
    {
      ok: result.tier != null,
      label: t("checkScore", { score: result.finalScore ?? "—", min: policy.bronzeMin }),
      value: ((result.finalScore ?? 0) / 10) * 100,
      missing: [],
    },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {certificate ? (
        <Card className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center" data-testid="certificate-card">
          <TierSeal tier={certificate.tier} label={t(`tiers.${certificate.tier}`)} size={compact ? 64 : 88} />
          <div className="grid min-w-0 gap-2">
            <div>
              <p className="text-sm font-extrabold text-muted">{t("issuedTitle")}</p>
              <h2 className="font-display text-xl font-extrabold sm:text-2xl">
                {t(`tiers.${certificate.tier}`)} · {certificate.finalScore}/10
              </h2>
              <p className="text-sm text-muted">
                {certificate.serial} · {t("issued")}{" "}
                {format.dateTime(certificate.issuedAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href={`/api/certificates/${certificate.id}/pdf?lang=kk`}
                download
                className={buttonVariants({ size: "sm" })}
              >
                <Download aria-hidden />
                {t("downloadKk")}
              </a>
              <a
                href={`/api/certificates/${certificate.id}/pdf?lang=ru`}
                download
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                <Download aria-hidden />
                {t("downloadRu")}
              </a>
              <Link
                href={`/verify/${certificate.verifyCode}`}
                className={buttonVariants({ size: "sm", variant: "ghost" })}
              >
                <ShieldCheck aria-hidden />
                {t("verifyLink")}
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        <Card tone="tint" className="grid gap-1">
          <h2 className="text-lg font-bold">{t("notYet")}</h2>
          <p className="text-sm text-muted">{t("notYetBody")}</p>
        </Card>
      )}

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 className="text-lg font-bold">{t("requirements")}</h2>
        <ul className="grid gap-3">
          {checks.map((c) => (
            <li key={c.label} className="grid gap-1.5">
              <span className="flex items-center gap-2 text-sm font-bold">
                {c.ok ? (
                  <CircleCheck className="size-5 shrink-0 text-grass-700" aria-label={t("met")} />
                ) : (
                  <CircleDashed className="size-5 shrink-0 text-ink-500" aria-label={t("notMet")} />
                )}
                {c.label}
              </span>
              <Progress value={c.value} label={c.label} tone="sky" className="h-2" />
              {!compact && c.missing.length > 0 && (
                <p className="text-xs text-muted">
                  {t("missing")}: {c.missing.join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
        {!compact && (
          <div className="grid gap-2 border-t border-line pt-3">
            <h3 className="text-sm font-bold">{t("tiersTitle")}</h3>
            <ul className="flex flex-wrap gap-2">
              {TIERS.map((tier) => {
                const min = {
                  BRONZE: policy.bronzeMin,
                  SILVER: policy.silverMin,
                  GOLD: policy.goldMin,
                  PLATINUM: policy.platinumMin,
                }[tier];
                return (
                  <li
                    key={tier}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-sm font-bold",
                      (certificate?.tier ?? result.tier) === tier ? "border-ink-900" : "border-line",
                    )}
                  >
                    <span className="size-3 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />
                    {t(`tiers.${tier}`)} · {t("from", { min })}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>
    </div>
  );
}
