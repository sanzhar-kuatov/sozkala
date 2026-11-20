import { Ban, Download, RotateCcw, Search } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { TierSeal } from "@/components/certificates/certificate-status";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { getCertificateAdmin } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import { TIER_COLOR, TIERS } from "@/lib/certificates/rules";
import { reinstateCertificate, revokeCertificate, saveDefaultPolicy, saveTemplate } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("certificates") };
}

const FIELD = { BRONZE: "bronzeMin", SILVER: "silverMin", GOLD: "goldMin", PLATINUM: "platinumMin" } as const;

/** Certificate template, platform default tiers, and every issued certificate (revoke / reinstate). */
export default async function AdminCertificatesPage({ searchParams }: PageProps<"/[locale]/admin/certificates">) {
  const user = await requireRole("ADMIN");
  const q = String((await searchParams).q ?? "");
  const [{ policy, template, certificates }, t, tc, tl, format] = await Promise.all([
    getCertificateAdmin(user, q),
    getTranslations("admin"),
    getTranslations("certificate"),
    getTranslations("levels"),
    getFormatter(),
  ]);
  const label = "grid gap-1 text-sm font-extrabold";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("certs.title")}</h1>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="grid content-start gap-3">
          <div>
            <h2 className="text-lg font-bold">{t("certs.defaults")}</h2>
            <p className="text-sm text-muted">{t("certs.defaultsHint")}</p>
          </div>
          <ActionForm action={saveDefaultPolicy} submit={t("save")}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TIERS.map((tier) => (
                <label key={tier} className={label}>
                  <span className="flex items-center gap-1.5">
                    <span className="size-3 rounded-full" style={{ background: TIER_COLOR[tier] }} aria-hidden />
                    {tc(`tiers.${tier}`)}
                  </span>
                  <Input
                    type="number"
                    name={FIELD[tier]}
                    min={0}
                    max={10}
                    step={0.1}
                    required
                    defaultValue={policy[FIELD[tier]]}
                    className="min-h-10 py-2"
                  />
                </label>
              ))}
            </div>
            <label className={`${label} max-w-xs`}>
              {tc("teacher.minLevel")}
              <Select name="minBuildingLevel" defaultValue={policy.minBuildingLevel} className="min-h-10">
                {([1, 2, 3, 4, 5] as const).map((n) => (
                  <option key={n} value={n}>
                    L{n} · {tl(String(n) as "1")}
                  </option>
                ))}
              </Select>
            </label>
          </ActionForm>
        </Card>

        {template && (
          <Card className="grid content-start gap-3">
            <div>
              <h2 className="text-lg font-bold">{t("certs.template")}</h2>
              <p className="text-sm text-muted">{t("certs.templateHint")}</p>
            </div>
            <ActionForm action={saveTemplate.bind(null, template.id)} submit={t("save")}>
              <label className={label}>
                {t("certs.titleKk")}
                <Input
                  name="titleKk"
                  required
                  minLength={3}
                  maxLength={60}
                  defaultValue={template.titleKk}
                  className="min-h-10 py-2"
                />
              </label>
              <label className={label}>
                {t("certs.titleRu")}
                <Input
                  name="titleRu"
                  required
                  minLength={3}
                  maxLength={60}
                  defaultValue={template.titleRu}
                  className="min-h-10 py-2"
                />
              </label>
            </ActionForm>
          </Card>
        )}
      </div>

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("certs.issued")}</h2>
        <form role="search" className="flex gap-2">
          <Input
            name="q"
            defaultValue={q}
            placeholder={t("certs.search")}
            aria-label={t("certs.search")}
            className="min-h-10 py-2"
          />
          <Button type="submit" variant="ghost">
            <Search aria-hidden />
            {t("users.find")}
          </Button>
        </form>
        {certificates.length === 0 ? (
          <p className="text-sm text-muted">{t("certs.none")}</p>
        ) : (
          <ul className="grid gap-2">
            {certificates.map((c) => (
              <li
                key={c.id}
                className="grid items-center gap-3 rounded-md border border-line bg-surface p-3 text-sm sm:grid-cols-[auto_minmax(0,1fr)_auto]"
              >
                <TierSeal tier={c.tier} label={tc(`tiers.${c.tier}`)} size={36} />
                <span className="min-w-0">
                  <b>
                    {c.student.lastName} {c.student.firstName}
                  </b>
                  {c.class && <span className="text-muted"> · {c.class.name}</span>}
                  <span className="block text-xs text-muted">
                    <span className="font-mono">{c.serial}</span> · {tc(`tiers.${c.tier}`)} · {c.finalScore}/10 ·{" "}
                    {format.dateTime(c.issuedAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
                  </span>
                </span>
                <span className="flex flex-wrap items-center justify-end gap-2">
                  {c.revokedReason === "REPLACED" && <Chip>{t("certs.replaced")}</Chip>}
                  {c.revokedReason === "REVOKED" && <Chip tone="warning">{t("certs.revoked")}</Chip>}
                  <a
                    href={`/api/certificates/${c.id}/pdf`}
                    download
                    className="inline-flex items-center gap-1 font-bold text-primary-edge"
                  >
                    <Download className="size-4" aria-hidden />
                    PDF
                  </a>
                  {!c.revokedAt && (
                    <ActionForm
                      action={revokeCertificate.bind(null, c.id)}
                      submit={
                        <>
                          <Ban aria-hidden />
                          {t("certs.revoke")}
                        </>
                      }
                      variant="ghost"
                      size="sm"
                      confirm={t("certs.revokeConfirm", { serial: c.serial })}
                    />
                  )}
                  {c.revokedReason === "REVOKED" && (
                    <ActionForm
                      action={reinstateCertificate.bind(null, c.id)}
                      submit={
                        <>
                          <RotateCcw aria-hidden />
                          {t("certs.reinstate")}
                        </>
                      }
                      variant="ghost"
                      size="sm"
                    />
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
