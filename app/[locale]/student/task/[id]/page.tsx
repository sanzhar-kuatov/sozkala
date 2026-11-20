import { ArrowLeft, CalendarClock, ClipboardList, Lock, PenLine, RotateCcw, Timer } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { MaterialsList } from "@/components/tasks/materials";
import { TaskPlayer } from "@/components/tasks/task-player";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getStudentTask } from "@/lib/student/attempts";
import { StartButton } from "./start-button";

export async function generateMetadata({ params }: PageProps<"/[locale]/student/task/[id]">): Promise<Metadata> {
  const user = await requireRole("STUDENT");
  const task = await getStudentTask(user, (await params).id);
  return { title: task?.title };
}

/** Task intro (limits, attempts) → player once an attempt is in progress. */
export default async function TaskPage({ params }: PageProps<"/[locale]/student/task/[id]">) {
  const { id } = await params;
  const user = await requireRole("STUDENT");
  const task = await getStudentTask(user, id);
  if (!task) notFound();

  const backHref = `/student/building/${task.buildingKey}`;

  if (task.inProgress) {
    return (
      <TaskPlayer
        attemptId={task.inProgress.id}
        title={task.title}
        instruction={task.instruction}
        type={task.type}
        content={task.content}
        criteria={task.criteria}
        initialAnswers={task.inProgress.answers}
        endsAt={task.inProgress.endsAt?.toISOString() ?? null}
        backHref={backHref}
        materials={task.materials}
      />
    );
  }

  const t = await getTranslations("task");
  const tb = await getTranslations("building");
  const format = await getFormatter();

  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge">
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <Card className="grid gap-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={task.grading === "AUTO" ? "auto" : "manual"}>
            {task.required ? tb("required") : tb("optional")}
          </Chip>
          <h1 className="text-2xl font-extrabold">{task.title}</h1>
        </div>
        <p className="text-lg">{task.instruction}</p>
        <MaterialsList materials={task.materials} />

        <ul className="grid gap-2 text-sm font-bold text-ink-700 sm:grid-cols-2">
          <li className="flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" aria-hidden />
            {t("questions", { count: task.content.questions.length })}
          </li>
          <li className="flex items-center gap-2">
            <Timer className="size-4 text-primary" aria-hidden />
            {task.timeLimitSec ? t("timeLimit", { min: Math.round(task.timeLimitSec / 60) }) : t("noLimit")}
          </li>
          <li className="flex items-center gap-2">
            <RotateCcw className="size-4 text-primary" aria-hidden />
            {task.maxAttempts != null
              ? t("attemptsLeft", { used: task.attemptsUsed, max: task.maxAttempts })
              : t("attemptsUnlimited")}
          </li>
          {task.deadline && (
            <li className="flex items-center gap-2">
              <CalendarClock className="size-4 text-primary" aria-hidden />
              {t("deadline", {
                date: format.dateTime(task.deadline, { day: "2-digit", month: "2-digit", year: "numeric" }),
              })}
            </li>
          )}
        </ul>

        {task.grading === "MANUAL" && (
          <div className="rounded-md bg-violet-100 p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-violet-700">
              <PenLine className="size-4" aria-hidden />
              {t("manualNote")}
            </p>
            {task.criteria && (
              <ul className="mt-2 grid gap-1">
                {task.criteria.map((c) => (
                  <li key={c.id} className="flex justify-between gap-3">
                    <span>{c.title}</span>
                    <b>{t("points", { max: c.max })}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {task.blocked ? (
          <p className="flex items-start gap-2 rounded-md bg-ink-100 px-4 py-3 font-semibold text-ink-700">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t(`blocked.${task.blocked}`)}
          </p>
        ) : (
          <StartButton taskId={task.id} retake={task.attemptsUsed > 0} />
        )}
      </Card>
    </div>
  );
}
