import { ArrowLeft, CalendarClock, CircleCheck, Hourglass, Lock, Play, RotateCcw, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BUILDING_ICONS, levelColor } from "@/components/city/building-icon";
import { LevelSteps } from "@/components/city/city-explorer";
import { buildingSvg } from "@/components/city/engine/buildings";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { BUILDINGS, isBuildingKey } from "@/lib/domain/buildings";
import { scoreForNextLevel } from "@/lib/domain/levels";
import { getBuildingDetail, type TaskRow } from "@/lib/student/building";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/student/building/[key]">): Promise<Metadata> {
  const { key } = await params;
  const locale = (await getLocale()) as "kk" | "ru";
  return { title: BUILDINGS.find((b) => b.key === key)?.name[locale] };
}

/** Building page (wireframe §3.3): big building, level steps, history and tasks. */
export default async function BuildingPage({ params }: PageProps<"/[locale]/student/building/[key]">) {
  const { key } = await params;
  if (!isBuildingKey(key)) notFound();
  const user = await requireRole("STUDENT");
  const detail = await getBuildingDetail(user, user.id, key);
  if (!detail) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";
  const info = BUILDINGS.find((b) => b.key === key)!;
  const { state } = detail;
  const Icon = BUILDING_ICONS[key];
  const next = scoreForNextLevel(state.level);
  const lockedBy = state.lockedBy && BUILDINGS.find((b) => b.key === state.lockedBy!.key)!.name[locale];

  return (
    <div className="grid gap-5">
      <Link href="/student" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge">
        <ArrowLeft className="size-4" aria-hidden />
        {t("building.back")}
      </Link>

      <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="grid content-start gap-3">
          <div className="flex items-center gap-3">
            <span
              className="grid size-11 place-items-center rounded-md text-white"
              style={{ background: levelColor(state.level) }}
            >
              <Icon className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold">{info.name[locale]}</h1>
              <p className="text-sm text-muted">{info.area[locale]}</p>
            </div>
          </div>
          <div
            className="sky-gradient rounded-md"
            dangerouslySetInnerHTML={{ __html: buildingSvg(key, state.level, { label: info.name[locale] }) }}
          />
          <LevelSteps level={state.level} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="font-bold text-muted">{t("city.level")}</dt>
            <dd className="font-extrabold">{t(`levels.${state.level as 0 | 1 | 2 | 3 | 4 | 5}`)}</dd>
            <dt className="font-bold text-muted">{t("city.score")}</dt>
            <dd className="font-extrabold">{state.score != null ? `${state.score}/10` : t("city.noScore")}</dd>
            <dt className="font-bold text-muted">{t("building.scoring")}</dt>
            <dd className="font-extrabold">{t(`city.modes.${state.scoringMode}`)}</dd>
          </dl>
          <p className="text-sm font-bold text-ink-700">
            {next == null ? t("city.maxLevel") : t("city.next", { score: next })}
          </p>

          <h2 className="mt-2 text-lg font-bold">{t("building.history")}</h2>
          {detail.history.length === 0 ? (
            <p className="text-sm text-muted">{t("building.noHistory")}</p>
          ) : (
            <ol className="grid gap-1.5 text-sm">
              {detail.history.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Sparkles className="size-4 shrink-0" style={{ color: levelColor(e.to) }} aria-hidden />
                  <span className="font-bold">{t("building.event", { from: e.from, to: e.to, score: e.score })}</span>
                  <span className="ml-auto text-xs text-muted">
                    {format.dateTime(e.at, { day: "2-digit", month: "2-digit" })}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <section aria-labelledby="tasks-title" className="grid content-start gap-3">
          <h2 id="tasks-title" className="text-xl font-extrabold">
            {t("building.tasksTitle")}
          </h2>

          {state.lockedBy ? (
            <Card className="flex items-start gap-3">
              <Lock className="mt-0.5 size-5 shrink-0 text-ink-500" aria-hidden />
              <div>
                <p className="font-bold">{t("building.lockedTitle")}</p>
                <p className="text-sm text-muted">
                  {t("city.unlockRule", { building: lockedBy ?? "", level: state.lockedBy.minLevel })}
                </p>
              </div>
            </Card>
          ) : detail.tasks.length === 0 ? (
            <Card tone="flat">
              <p className="text-muted">{t("city.noTasks")}</p>
            </Card>
          ) : (
            <>
              <ul className="grid gap-2">
                {detail.tasks.map((task) => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

async function TaskItem({ task }: { task: TaskRow }) {
  const t = await getTranslations("building");
  const format = await getFormatter();
  const status = {
    new: { icon: Play, cls: "bg-sky-100 text-sky-700", text: t("status.new") },
    done: {
      icon: CircleCheck,
      cls: "bg-grass-100 text-grass-700",
      text: t("status.done", { score: task.bestScore ?? 0 }),
    },
    pending: { icon: Hourglass, cls: "bg-violet-100 text-violet-700", text: t("status.pending") },
    returned: { icon: RotateCcw, cls: "bg-coral-100 text-coral-700", text: t("status.returned") },
  }[task.status];
  const StatusIcon = status.icon;

  return (
    <li>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span
          className={cn("size-3 shrink-0 rounded-full", task.required ? "bg-primary" : "border-2 border-ink-300")}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{task.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <Chip tone={task.grading === "AUTO" ? "auto" : "manual"} className="px-2 py-0.5 text-[11px]">
              {task.required ? t("required") : t("optional")}
            </Chip>
            {task.deadline && (
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden />
                {t("deadline", { date: format.dateTime(task.deadline, { day: "2-digit", month: "2-digit" }) })}
              </span>
            )}
            <span>
              {task.maxAttempts != null
                ? t("attempts", { used: task.attemptsUsed, max: task.maxAttempts })
                : t("attemptsUnlimited", { used: task.attemptsUsed })}
            </span>
          </div>
        </div>
        <span
          className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-extrabold", status.cls)}
        >
          <StatusIcon className="size-3.5" aria-hidden />
          {status.text}
        </span>
        {task.lastAttemptId && (
          <Link
            href={`/student/task/${task.id}/result/${task.lastAttemptId}`}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            {t("result")}
          </Link>
        )}
        <Link
          href={`/student/task/${task.id}`}
          className={buttonVariants({
            size: "sm",
            variant: task.status === "done" && !task.inProgress ? "ghost" : "primary",
          })}
        >
          {task.inProgress
            ? t("continue")
            : task.status === "done" || task.status === "returned"
              ? t("retake")
              : t("start")}
        </Link>
      </Card>
    </li>
  );
}
