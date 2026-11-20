import { ArrowLeft, CircleCheck, Hourglass, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { levelColor } from "@/components/city/building-icon";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { BUILDINGS } from "@/lib/domain/buildings";
import { getCityView } from "@/lib/student/city";
import { assertTeachesStudent } from "@/lib/teacher/access";
import { ReadOnlyCity } from "@/components/city/read-only-city";
import { PersonalTaskForm, RetakeForm } from "./student-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teacher.student");
  return { title: t("title") };
}

/** One student (wireframe §4.5): city, levels, topic results, attempts, retake / personal task. */
export default async function StudentDetailPage({ params }: PageProps<"/[locale]/teacher/students/[id]">) {
  const { id } = await params;
  const user = await requireRole("TEACHER");
  try {
    await assertTeachesStudent(user, id);
  } catch {
    notFound();
  }
  const view = await getCityView(user, id);
  if (!view) notFound();

  const t = await getTranslations();
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";

  const [attempts, classes, ownTasks] = await Promise.all([
    db.attempt.findMany({
      where: { studentId: id, status: { not: "IN_PROGRESS" } },
      orderBy: { submittedAt: "desc" },
      take: 30,
      select: {
        id: true,
        status: true,
        score: true,
        submittedAt: true,
        number: true,
        task: { select: { id: true, title: true, topic: { select: { title: true } } } },
      },
    }),
    db.classMember.findMany({ where: { studentId: id }, select: { class: { select: { id: true, name: true } } } }),
    db.task.findMany({
      where: { authorId: user.id, status: "PUBLISHED" },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  // Average per topic (spec §2.2 "topic performance").
  const byTopic = new Map<string, number[]>();
  for (const a of attempts) {
    if (a.status !== "GRADED" || a.score == null) continue;
    const key = a.task.topic?.title ?? a.task.title;
    byTopic.set(key, [...(byTopic.get(key) ?? []), a.score]);
  }
  const topics = [...byTopic].map(([title, s]) => ({
    title,
    avg: Math.round((s.reduce((x, y) => x + y, 0) / s.length) * 10) / 10,
  }));
  const levels = Object.fromEntries(view.buildings.map((b) => [b.key, b.level]));

  return (
    <div className="grid gap-4">
      <Link
        href={classes[0] ? `/teacher/classes/${classes[0].class.id}` : "/teacher/classes"}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {classes[0]?.class.name ?? t("nav.teacher.classes")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            {view.student.firstName} {view.student.lastName}
          </h1>
          <p className="text-sm font-bold text-muted">
            «{view.city.name}» · {classes.map((c) => c.class.name).join(", ")}
          </p>
        </div>
        <div className="flex w-56 items-center gap-2">
          <Progress value={view.completion} label={t("city.completion")} className="flex-1" />
          <span className="font-extrabold">{view.completion}%</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-4">
          <ReadOnlyCity
            levels={levels}
            decorations={view.decorations}
            cityName={view.city.name}
            labels={{
              map: t("city.mapLabel", { name: view.city.name }),
              zoomIn: t("city.zoomIn"),
              zoomOut: t("city.zoomOut"),
              zoomReset: t("city.zoomReset"),
            }}
          />
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("teacher.student.buildings")}</h2>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {view.buildings.map((b) => (
                <li key={b.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="grid size-6 place-items-center rounded-full text-xs font-extrabold text-white"
                    style={{ background: levelColor(b.level) }}
                  >
                    {b.level}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-bold">
                    {BUILDINGS.find((x) => x.key === b.key)!.name[locale]}
                  </span>
                  <span className="text-muted">
                    {b.score != null ? `${b.score}/10` : "—"} · {b.tasks.done}/{b.tasks.total}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("teacher.student.attempts")}</h2>
            {attempts.length === 0 ? (
              <p className="text-sm text-muted">{t("teacher.student.noAttempts")}</p>
            ) : (
              <ul className="grid gap-1 text-sm">
                {attempts.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 odd:bg-paper">
                    {a.status === "GRADED" ? (
                      <CircleCheck className="size-4 shrink-0 text-grass-700" aria-hidden />
                    ) : a.status === "PENDING_REVIEW" ? (
                      <Hourglass className="size-4 shrink-0 text-violet-700" aria-hidden />
                    ) : (
                      <RotateCcw className="size-4 shrink-0 text-coral-700" aria-hidden />
                    )}
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {a.task.title} · #{a.number}
                    </span>
                    {a.status === "PENDING_REVIEW" ? (
                      <Link href={`/teacher/review/${a.id}`} className="font-bold text-primary-edge">
                        {t("review.open")}
                      </Link>
                    ) : (
                      <b>{a.score != null ? `${a.score}/10` : t("review.returned")}</b>
                    )}
                    {a.submittedAt && (
                      <span className="w-12 text-right text-xs text-muted">
                        {format.dateTime(a.submittedAt, { day: "2-digit", month: "2-digit" })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid min-w-0 content-start gap-4 [&_ul]:grid-cols-[minmax(0,1fr)] [&>*]:min-w-0 [&>*]:grid-cols-[minmax(0,1fr)]">
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("teacher.student.topics")}</h2>
            {topics.length === 0 ? (
              <p className="text-sm text-muted">{t("teacher.student.noAttempts")}</p>
            ) : (
              <ul className="grid gap-2 text-sm">
                {topics.map((tp) => (
                  <li key={tp.title} className="grid gap-1">
                    <span className="flex justify-between gap-2 font-semibold">
                      <span className="truncate">{tp.title}</span>
                      <b>{tp.avg}</b>
                    </span>
                    <Progress value={tp.avg * 10} label={tp.title} tone="sky" className="h-2" />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <RetakeForm studentId={id} tasks={ownTasks} />
          </Card>
          <Card>
            <PersonalTaskForm studentId={id} tasks={ownTasks} />
          </Card>
        </div>
      </div>
    </div>
  );
}
