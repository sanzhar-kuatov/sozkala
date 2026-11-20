import { Hourglass, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { levelColor } from "@/components/city/building-icon";
import { ProgressCard } from "@/components/charts/progress-card";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { BUILDINGS } from "@/lib/domain/buildings";
import { getLearningHistory } from "@/lib/student/history";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.student");
  return { title: t("history") };
}

/** Personal progress (spec §9): stats, score line and the attempt timeline with level-ups. */
export default async function StudentHistoryPage() {
  const user = await requireRole("STUDENT");
  const [h, t, format, locale] = await Promise.all([
    getLearningHistory(user, user.id),
    getTranslations("history"),
    getFormatter(),
    getLocale() as Promise<"kk" | "ru">,
  ]);
  const bName = (key: string) => BUILDINGS.find((b) => b.key === key)!.name[locale];

  const tiles = [
    { label: t("average"), value: h.summary.average ?? "—" },
    { label: t("best"), value: h.summary.best ?? "—" },
    { label: t("tasksDone"), value: h.summary.tasksDone },
    { label: t("attempts"), value: h.summary.attempts },
    { label: t("levelUps"), value: h.summary.levelUps },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card className="p-4">
              <span className="block font-display text-3xl font-extrabold">{tile.value}</span>
              <span className="block text-sm font-bold text-muted">{tile.label}</span>
            </Card>
          </li>
        ))}
      </ul>

      <ProgressCard series={h.series} />

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 className="text-lg font-bold">{t("timeline")}</h2>
        {h.timeline.length === 0 ? (
          <p className="text-sm text-muted">{t("empty")}</p>
        ) : (
          <ol className="grid gap-2">
            {h.timeline.map((e) => (
              <li
                key={e.id}
                className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-x-3 rounded-md border border-line px-3 py-2 text-sm"
              >
                <span className="text-xs text-muted tabular-nums">
                  {e.at ? format.dateTime(e.at, { day: "2-digit", month: "2-digit" }) : "—"}
                </span>
                <span className="min-w-0">
                  <Link href={`/student/task/${e.taskId}/result/${e.id}`} className="font-bold text-fg">
                    {e.title}
                  </Link>
                  <span className="block text-xs text-muted">
                    {bName(e.building)} · {t("attemptNo", { n: e.number })}
                  </span>
                  {e.levelUp && (
                    <span className="mt-0.5 flex items-center gap-1 text-xs font-extrabold text-ink-700">
                      <Sparkles className="size-4" style={{ color: levelColor(e.levelUp.to) }} aria-hidden />
                      {t("levelUp", { from: e.levelUp.from, to: e.levelUp.to })}
                    </span>
                  )}
                </span>
                {e.status === "GRADED" ? (
                  <span className="font-display text-lg font-extrabold tabular-nums">{e.score}/10</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-bold text-muted">
                    <Hourglass className="size-4" aria-hidden />
                    {t("pending")}
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
