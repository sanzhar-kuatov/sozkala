import { ArrowLeft, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import type { TaskContent } from "@/lib/student/attempts";
import { countWords } from "@/lib/tasks/answers";
import { criteriaSchema } from "@/lib/tasks/schemas";
import { getReviewAttempt } from "@/lib/teacher/review";
import { RubricForm } from "./rubric-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("review");
  return { title: t("title") };
}

/** Review screen (wireframe §4.4): student work on the left, rubric on the right. */
export default async function ReviewAttemptPage({ params }: PageProps<"/[locale]/teacher/review/[attemptId]">) {
  const { attemptId } = await params;
  const user = await requireRole("TEACHER", "ADMIN");
  const attempt = await getReviewAttempt(user, attemptId);
  if (!attempt || attempt.task.grading !== "MANUAL") notFound();

  const t = await getTranslations("review");
  const tt = await getTranslations("task");
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";
  const content = attempt.task.content as TaskContent;
  const answers = (attempt.answers ?? {}) as Record<string, { text?: string; file?: string }>;
  const criteria = criteriaSchema.safeParse(attempt.task.criteria);
  const buildingKey = attempt.task.building.key as BuildingKey;
  const progress = await db.buildingProgress.findFirst({
    where: { cityId: attempt.student.city?.id ?? "", buildingTypeId: attempt.task.buildingTypeId },
    select: { level: true },
  });

  return (
    <div className="grid gap-4">
      <Link href="/teacher/review" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge">
        <ArrowLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold">
          {attempt.student.firstName} {attempt.student.lastName} · {attempt.task.title}
        </h1>
        <p className="text-sm font-bold text-muted">
          {t("attemptN", { n: attempt.number })}
          {attempt.submittedAt &&
            ` · ${format.dateTime(attempt.submittedAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="grid content-start gap-4">
          {content.passage && (
            <details className="rounded-md bg-cream p-3">
              <summary className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                <BookOpen className="size-4" aria-hidden />
                {content.source ?? tt("passage")}
              </summary>
              <p className="mt-2">{content.passage}</p>
            </details>
          )}
          {content.questions.map((q) => {
            const a = answers[q.id];
            return (
              <div key={q.id} className="grid gap-2">
                <p className="text-sm font-bold text-muted">
                  {t("prompt")}: <span className="text-fg">{q.prompt}</span>
                </p>
                {typeof q.readText === "string" && (
                  <blockquote className="border-l-4 border-primary pl-3 whitespace-pre-line text-muted">
                    {q.readText}
                  </blockquote>
                )}
                <h2 className="mt-2 text-lg font-bold">{t("work")}</h2>
                {attempt.task.type === "AUDIO" ? (
                  a?.file ? (
                    <audio controls src={`/api/files/${a.file}`} className="w-full" />
                  ) : (
                    <p className="text-muted">{t("noWork")}</p>
                  )
                ) : a?.text?.trim() ? (
                  <>
                    <p className="rounded-md bg-paper p-4 text-lg leading-relaxed whitespace-pre-line">{a.text}</p>
                    <p className="text-sm font-bold text-muted">{t("words", { count: countWords(a.text) })}</p>
                  </>
                ) : (
                  <p className="text-muted">{t("noWork")}</p>
                )}
              </div>
            );
          })}
        </Card>

        <Card className="content-start lg:sticky lg:top-20 lg:self-start">
          {attempt.status !== "PENDING_REVIEW" ? (
            <p className="font-bold text-muted">
              {t("alreadyDone")} {attempt.score != null && `${attempt.score}/10`}
            </p>
          ) : criteria.success ? (
            <RubricForm
              attemptId={attempt.id}
              criteria={criteria.data}
              buildingName={BUILDINGS.find((b) => b.key === buildingKey)!.name[locale]}
              currentLevel={progress?.level ?? 0}
            />
          ) : null}
        </Card>
      </div>
    </div>
  );
}
