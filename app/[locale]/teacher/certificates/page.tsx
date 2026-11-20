import { CircleCheck, Download } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { TierSeal } from "@/components/certificates/certificate-status";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getClassCertificates } from "@/lib/certificates/service";
import { listClasses } from "@/lib/teacher/classes";
import { cn } from "@/lib/utils";
import { PolicyForm } from "./policy-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("certificates") };
}

/** Certificate thresholds and the class's certificates (spec §2.2, §7). */
export default async function TeacherCertificatesPage({ searchParams }: PageProps<"/[locale]/teacher/certificates">) {
  const user = await requireRole("TEACHER");
  const [t, format] = await Promise.all([getTranslations("certificate"), getFormatter()]);
  const classes = (await listClasses(user)).filter((c) => !c.archivedAt);
  const wanted = (await searchParams).class;
  const klass = classes.find((c) => c.id === wanted) ?? classes[0];

  if (!klass) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("teacher.title")}</h1>
        <Card tone="flat">
          <p className="text-muted">{t("teacher.noClasses")}</p>
        </Card>
      </div>
    );
  }

  const { policy, students } = await getClassCertificates(user, klass.id);
  const th = "border-b border-line px-2 py-2 font-bold";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold sm:text-3xl">
          {t("teacher.title")} · {klass.name}
        </h1>
        {classes.length > 1 && (
          <nav aria-label={t("teacher.classPicker")} className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/teacher/certificates?class=${c.id}`}
                aria-current={c.id === klass.id ? "page" : undefined}
                className={cn(
                  "rounded-full border-2 px-3 py-1 text-sm font-extrabold no-underline",
                  c.id === klass.id ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-700",
                )}
              >
                {c.name}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("teacher.policy")}</h2>
          <p className="text-sm text-muted">
            {policy.own ? t("teacher.policyOwn") : t("teacher.policyDefault")} {t("teacher.policyHint")}
          </p>
        </div>
        <PolicyForm classId={klass.id} policy={policy} own={policy.own} />
      </Card>

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 className="text-lg font-bold">{t("teacher.students")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className={th}>
                  {t("teacher.student")}
                </th>
                <th scope="col" className={th}>
                  {t("teacher.tasks")}
                </th>
                <th scope="col" className={th}>
                  {t("teacher.buildings")}
                </th>
                <th scope="col" className={th}>
                  {t("finalScore")}
                </th>
                <th scope="col" className={th}>
                  {t("teacher.certificate")}
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id} className="odd:bg-paper">
                  <td className="px-2 py-2">
                    <Link href={`/teacher/students/${s.id}`} className="font-bold text-fg">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {s.result.tasks.done}/{s.result.tasks.total}
                  </td>
                  <td className="px-2 py-2 tabular-nums">
                    {s.result.buildings.built}/{s.result.buildings.total}
                  </td>
                  <td className="px-2 py-2 font-extrabold tabular-nums">{s.result.finalScore ?? "—"}</td>
                  <td className="px-2 py-2">
                    {s.certificate ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <TierSeal tier={s.certificate.tier} label={t(`tiers.${s.certificate.tier}`)} size={28} />
                        <span className="grid">
                          <b>{t(`tiers.${s.certificate.tier}`)}</b>
                          <small className="text-muted">
                            {s.certificate.serial} ·{" "}
                            {format.dateTime(s.certificate.issuedAt, {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </small>
                        </span>
                        <a
                          href={`/api/certificates/${s.certificate.id}/pdf`}
                          download
                          className="inline-flex items-center gap-1 font-bold text-primary-edge"
                        >
                          <Download className="size-4" aria-hidden />
                          PDF
                        </a>
                      </span>
                    ) : s.result.eligible ? (
                      <Chip tone="auto">
                        <CircleCheck aria-hidden />
                        {t("teacher.ready")}
                      </Chip>
                    ) : (
                      <span className="text-muted">{t("teacher.inProgress")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
