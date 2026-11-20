import { CircleCheck, Hourglass, Lock, Sparkles, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { levelColor } from "@/components/city/building-icon";
import { ReadOnlyCity } from "@/components/city/read-only-city";
import { CertificateStatus } from "@/components/certificates/certificate-status";
import { ProgressCard } from "@/components/charts/progress-card";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { AuthError, requireRole } from "@/lib/auth/guards";
import { BUILDINGS } from "@/lib/domain/buildings";
import { getCertificateView } from "@/lib/certificates/service";
import { getChildOverview, linkedChildren } from "@/lib/parent/child";
import { getLearningHistory } from "@/lib/student/history";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.parent");
  return { title: t("overview") };
}

/** Parent view of one child (wireframe §5): read-only everywhere (spec §2.3, acceptance #6–#7). */
export default async function ChildPage({ params }: PageProps<"/[locale]/parent/child/[id]">) {
  const { id } = await params;
  const user = await requireRole("PARENT");
  const data = await getChildOverview(user, id).catch((e) => {
    if (e instanceof AuthError) return null; // not this parent's child → 404, nothing is revealed
    throw e;
  });
  if (!data) notFound();

  const [children, t, format, locale, progress, certificate] = await Promise.all([
    linkedChildren(user),
    getTranslations(),
    getFormatter(),
    getLocale() as Promise<"kk" | "ru">,
    getLearningHistory(user, id),
    getCertificateView(user, id),
  ]);
  const child = children.find((c) => c.id === id)!;
  const name = (key: string) => BUILDINGS.find((b) => b.key === key)!.name[locale];
  const levels = Object.fromEntries(data.city.buildings.map((b) => [b.key, b.level]));

  const stats = [
    { label: t("parent.average"), value: data.stats.average != null ? `${data.stats.average}` : "—" },
    { label: t("parent.tasksDone"), value: data.stats.tasksDone },
    { label: t("parent.completion"), value: `${data.city.completion}%` },
    { label: t("parent.badges"), value: data.stats.badges },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{child.name}</h1>
          <p className="text-sm font-bold text-muted">
            «{data.city.city.name}»{child.className && ` · ${child.className}`}
          </p>
        </div>
        {children.length > 1 && (
          <nav aria-label={t("parent.chooseChild")} className="flex flex-wrap gap-2">
            {children.map((c) => (
              <Link
                key={c.id}
                href={`/parent/child/${c.id}`}
                aria-current={c.id === id ? "page" : undefined}
                className={cn(
                  "rounded-full border-2 px-3 py-1 text-sm font-extrabold no-underline",
                  c.id === id ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-700",
                )}
              >
                {c.name.split(" ")[0]}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <p className="flex items-center gap-2 rounded-md bg-[#FFE5D3] px-3 py-2 text-sm font-bold text-[#B85314]">
        <Lock className="size-4 shrink-0" aria-hidden />
        {t("parent.readOnly")}
      </p>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <li key={s.label}>
            <Card className="p-4">
              <span className="block font-display text-2xl font-extrabold">{s.value}</span>
              <span className="block text-sm font-bold text-muted">{s.label}</span>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid content-start gap-4">
          <ReadOnlyCity
            levels={levels}
            decorations={data.city.decorations}
            cityName={data.city.city.name}
            labels={{
              map: t("city.mapLabel", { name: data.city.city.name }),
              zoomIn: t("city.zoomIn"),
              zoomOut: t("city.zoomOut"),
              zoomReset: t("city.zoomReset"),
            }}
          />
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("parent.buildings")}</h2>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {data.city.buildings.map((b) => (
                <li key={b.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="grid size-6 place-items-center rounded-full text-xs font-extrabold text-white"
                    style={{ background: levelColor(b.level) }}
                  >
                    {b.level}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">{name(b.key)}</span>
                  <span className="text-muted">{t(`levels.${b.level as 0 | 1 | 2 | 3 | 4 | 5}`)}</span>
                </li>
              ))}
            </ul>
            <Progress value={data.city.completion} label={t("parent.completion")} />
          </Card>
          <ProgressCard series={progress.series} />
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("parent.history")}</h2>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted">{t("parent.noHistory")}</p>
            ) : (
              <ol className="grid gap-1.5 text-sm">
                {data.history.map((e, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Sparkles className="size-4 shrink-0" style={{ color: levelColor(e.to) }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <b>{name(e.building)}</b> · {t("parent.levelChange", { from: e.from, to: e.to, score: e.score })}
                    </span>
                    <span className="text-xs text-muted">
                      {format.dateTime(e.at, { day: "2-digit", month: "2-digit" })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-4 [&_ul]:grid-cols-[minmax(0,1fr)] [&>*]:min-w-0 [&>*]:grid-cols-[minmax(0,1fr)]">
          <Card className="grid gap-2">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <TriangleAlert className="size-5 text-sun-700" aria-hidden />
              {t("parent.difficult")}
            </h2>
            {data.difficult.length === 0 ? (
              <p className="text-sm text-muted">
                {data.topics.length ? t("parent.noDifficult") : t("parent.noResults")}
              </p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {data.difficult.map((tp) => (
                  <li key={tp.title} className="grid gap-1">
                    <span className="flex justify-between gap-2 font-semibold">
                      <span className="truncate">{tp.title}</span>
                      <b className="text-coral-700">{tp.average}/10</b>
                    </span>
                    <Progress value={tp.average * 10} label={tp.title} className="h-2" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("parent.recent")}</h2>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted">{t("parent.noResults")}</p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {data.recent.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 odd:bg-paper">
                    {r.status === "GRADED" ? (
                      <CircleCheck className="size-4 shrink-0 text-grass-700" aria-hidden />
                    ) : (
                      <Hourglass className="size-4 shrink-0 text-violet-700" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.title}</span>
                    <b>{r.status === "GRADED" ? `${r.score}/10` : t("parent.pending")}</b>
                    {r.at && (
                      <span className="w-11 text-right text-xs text-muted">
                        {format.dateTime(r.at, { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <section className="grid gap-2" aria-labelledby="child-certificate">
            <h2 id="child-certificate" className="text-lg font-bold">
              {t("parent.certificate")}
            </h2>
            <CertificateStatus view={certificate} compact />
          </section>
        </div>
      </div>
    </div>
  );
}
