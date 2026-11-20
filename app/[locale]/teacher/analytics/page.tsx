import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { BarList } from "@/components/charts/bar-list";
import { ColumnChart } from "@/components/charts/column-chart";
import { LineChart } from "@/components/charts/line-chart";
import { TableView } from "@/components/charts/table-view";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { BUILDINGS } from "@/lib/domain/buildings";
import { getClassAnalytics } from "@/lib/teacher/analytics";
import { listClasses } from "@/lib/teacher/classes";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("analytics") };
}

/** Class analytics (spec §9 for the teacher, wireframe §4.1). */
export default async function AnalyticsPage({ searchParams }: PageProps<"/[locale]/teacher/analytics">) {
  const user = await requireRole("TEACHER");
  const t = await getTranslations("analytics");
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";
  const classes = (await listClasses(user)).filter((c) => !c.archivedAt);
  const wanted = (await searchParams).class;
  const klass = classes.find((c) => c.id === wanted) ?? classes[0];

  if (!klass) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <Card tone="flat">
          <p className="text-muted">{t("noClasses")}</p>
        </Card>
      </div>
    );
  }

  const a = (await getClassAnalytics(user, klass.id))!;
  const day = (d: Date) => format.dateTime(d, { day: "2-digit", month: "2-digit" });
  const bName = (key: string) => BUILDINGS.find((b) => b.key === key)!.name[locale];

  const tiles = [
    { label: t("tasks"), value: a.summary.tasks },
    { label: t("average"), value: a.summary.average ?? "—" },
    { label: t("attempts"), value: a.summary.attempts },
    { label: t("buildingsBuilt"), value: a.summary.buildingsBuilt },
    { label: t("pending"), value: a.summary.pending, href: "/teacher/review" },
    { label: t("completion"), value: `${a.summary.completion}%` },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold sm:text-3xl">
          {t("title")} · {a.klass.name}
        </h1>
        {classes.length > 1 && (
          <nav aria-label={t("classPicker")} className="flex flex-wrap gap-2">
            {classes.map((c) => (
              <Link
                key={c.id}
                href={`/teacher/analytics?class=${c.id}`}
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

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card className="p-4">
              <span className="block font-display text-3xl font-extrabold">{tile.value}</span>
              {tile.href ? (
                <Link href={tile.href} className="text-sm font-bold text-primary-edge">
                  {tile.label}
                </Link>
              ) : (
                <span className="block text-sm font-bold text-muted">{tile.label}</span>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[repeat(2,minmax(0,1fr))]">
        <Card className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
          <div>
            <h2 className="text-lg font-bold">{t("byTopic")}</h2>
            <p className="text-sm text-muted">{t("byTopicHint")}</p>
          </div>
          {a.byTopic.length === 0 ? (
            <p className="text-sm text-muted">{t("noData")}</p>
          ) : (
            <BarList
              label={t("byTopic")}
              max={10}
              items={a.byTopic.map((r) => ({
                label: r.title,
                value: r.average,
                display: `${r.average}`,
                detail: t("topicDetail", { attempts: r.attempts, students: r.students }),
              }))}
            />
          )}
          <TableView
            summary={t("asTable")}
            head={[t("topic"), t("average"), t("attempts"), t("studentsCol")]}
            rows={a.byTopic.map((r) => [r.title, r.average, r.attempts, r.students])}
          />
        </Card>

        <Card className="grid grid-cols-[minmax(0,1fr)] content-start gap-3">
          <div>
            <h2 className="text-lg font-bold">{t("weekly")}</h2>
            <p className="text-sm text-muted">{t("weeklyHint")}</p>
          </div>
          <LineChart
            label={t("weekly")}
            yMax={10}
            yTicks={[0, 5, 10]}
            points={a.weekly.map((w) => ({
              x: day(w.start),
              value: w.average,
              detail: t("weekDetail", { attempts: w.attempts }),
            }))}
          />
          <h3 className="mt-2 font-bold">{t("attemptsWeekly")}</h3>
          <ColumnChart
            label={t("attemptsWeekly")}
            columns={a.weekly.map((w) => ({
              x: day(w.start),
              value: w.attempts,
              detail: `${day(w.start)}: ${w.attempts}`,
            }))}
          />
          <TableView
            summary={t("asTable")}
            head={[t("week"), t("average"), t("attempts")]}
            rows={a.weekly.map((w) => [day(w.start), w.average ?? "—", w.attempts])}
          />
        </Card>
      </div>

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("buildings")}</h2>
          <p className="text-sm text-muted">{t("buildingsHint")}</p>
        </div>
        <BarList
          label={t("buildings")}
          max={5}
          items={a.byBuilding.map((b) => ({
            label: bName(b.key),
            value: b.averageLevel,
            display: `${b.averageLevel} / 5`,
            detail: t("builtDetail", { built: b.built, total: a.summary.students }),
          }))}
        />
        <TableView
          summary={t("asTable")}
          head={[t("building"), t("avgLevel"), t("built")]}
          rows={a.byBuilding.map((b) => [bName(b.key), b.averageLevel, `${b.built}/${a.summary.students}`])}
        />
      </Card>

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 className="text-lg font-bold">{t("studentsTitle")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("student")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("completion")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("average")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("tasksDone")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("lastActive")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("attention")}
                </th>
              </tr>
            </thead>
            <tbody>
              {a.students.map((s) => (
                <tr key={s.id} className="odd:bg-paper">
                  <td className="px-2 py-2">
                    <Link href={`/teacher/students/${s.id}`} className="font-bold text-fg">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-2">
                      <Progress value={s.completion} label={t("completion")} className="h-2 w-20" />
                      <span className="tabular-nums">{s.completion}%</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 font-extrabold tabular-nums">{s.average ?? "—"}</td>
                  <td className="px-2 py-2 tabular-nums">{s.tasksDone}</td>
                  <td className="px-2 py-2 tabular-nums">{s.lastActive ? day(s.lastActive) : "—"}</td>
                  <td className="px-2 py-2">
                    <span className="flex flex-wrap gap-1">
                      {s.flags.map((f) => (
                        <Chip key={f} tone="warning" className="px-2 py-0.5 text-[11px]">
                          <TriangleAlert aria-hidden />
                          {t(`flags.${f}`)}
                        </Chip>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <h2 className="text-lg font-bold">{t("tasksTitle")}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("task")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("building")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("done")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("average")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("attempts")}
                </th>
                <th scope="col" className="border-b border-line px-2 py-2 font-bold">
                  {t("pending")}
                </th>
              </tr>
            </thead>
            <tbody>
              {a.tasks.map((task) => (
                <tr key={task.id} className="odd:bg-paper">
                  <td className="px-2 py-2">
                    <Link href={`/teacher/tasks/${task.id}`} className="font-bold text-fg">
                      {task.title}
                    </Link>
                  </td>
                  <td className="px-2 py-2 text-muted">{bName(task.building)}</td>
                  <td className="px-2 py-2 tabular-nums">
                    {task.studentsDone}/{a.summary.students}
                  </td>
                  <td className="px-2 py-2 font-extrabold tabular-nums">{task.average ?? "—"}</td>
                  <td className="px-2 py-2 tabular-nums">{task.attempts}</td>
                  <td className="px-2 py-2 tabular-nums">{task.pending || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
