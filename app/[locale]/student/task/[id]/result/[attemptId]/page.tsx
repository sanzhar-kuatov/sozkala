import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Hourglass,
  Lightbulb,
  Map,
  MessageSquareText,
  RotateCcw,
} from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BadgeMedal } from "@/components/rewards/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { QuestionResult } from "@/lib/grading/grade";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { levelForScore, scoreForNextLevel } from "@/lib/domain/levels";
import { buildingSvg } from "@/components/city/engine/buildings";
import { getLocale } from "next-intl/server";
import { modelAnswer } from "@/lib/grading/model-answer";
import { getStudentTask, type TaskContent } from "@/lib/student/attempts";
import { describeAnswer } from "@/lib/tasks/describe";
import type { TaskTypeValue } from "@/lib/tasks/schemas";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("result");
  return { title: t("title") };
}

/** Result screen (wireframe §3.5): score, mistakes, explanations, retake. */
export default async function ResultPage({ params }: PageProps<"/[locale]/student/task/[id]/result/[attemptId]">) {
  const { id, attemptId } = await params;
  const user = await requireRole("STUDENT");

  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, taskId: id, studentId: user.id, status: { not: "IN_PROGRESS" } },
    select: {
      number: true,
      status: true,
      answers: true,
      result: true,
      score: true,
      feedback: true,
      task: {
        select: {
          type: true,
          content: true,
          answerKey: true,
          explanation: true,
          title: true,
          building: { select: { key: true } },
        },
      },
    },
  });
  if (!attempt) notFound();

  const t = await getTranslations("result");
  const tt = await getTranslations("task");
  const task = await getStudentTask(user, id); // attempts left / retake availability (null if unassigned since)
  const type = attempt.task.type as TaskTypeValue;
  const content = attempt.task.content as TaskContent;
  const answers = (attempt.answers ?? {}) as Record<string, Record<string, unknown>>;
  const results = (attempt.result as QuestionResult[] | null) ?? null;
  const key = (attempt.task.answerKey ?? {}) as Record<string, Record<string, unknown>>;
  // Correct answers are revealed only when no attempts are left — otherwise a retake would be copy-paste.
  const reveal = task?.blocked === "noAttempts";
  const canRetake = task != null && !task.blocked;
  const buildingHref = `/student/building/${attempt.task.building.key}`;

  const praise =
    attempt.score == null
      ? null
      : attempt.score >= 9
        ? "excellent"
        : attempt.score >= 6
          ? "good"
          : attempt.score >= 4
            ? "ok"
            : "low";

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      <Card className="grid justify-items-center gap-3 p-6 text-center">
        <p className="text-sm font-bold text-muted">
          {attempt.task.title} · {t("attemptN", { n: attempt.number })}
        </p>

        {attempt.status === "GRADED" && attempt.score != null && (
          <>
            <ScoreRing score={attempt.score} />
            <h1 className="text-3xl font-extrabold">{t(`praise.${praise ?? "low"}`)}</h1>
          </>
        )}
        {attempt.status === "PENDING_REVIEW" && (
          <>
            <span className="grid size-20 place-items-center rounded-full bg-violet-100 text-violet-700">
              <Hourglass className="size-10" aria-hidden />
            </span>
            <h1 className="text-2xl font-extrabold">{t("sentTitle")}</h1>
            <p className="max-w-md text-muted">{t("sentBody")}</p>
          </>
        )}
        {attempt.status === "RETURNED" && (
          <>
            <span className="grid size-20 place-items-center rounded-full bg-coral-100 text-coral-700">
              <RotateCcw className="size-10" aria-hidden />
            </span>
            <h1 className="text-2xl font-extrabold">{t("returnedTitle")}</h1>
          </>
        )}

        {attempt.feedback && (
          <div className="w-full rounded-md bg-cream p-4 text-left">
            <p className="mb-1 flex items-center gap-2 text-sm font-bold">
              <MessageSquareText className="size-4 text-primary-edge" aria-hidden />
              {t("feedback")}
            </p>
            <p>{attempt.feedback}</p>
          </div>
        )}

        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {canRetake && (
            <Link href={`/student/task/${id}`} className={buttonVariants({ variant: "accent" })}>
              <RotateCcw aria-hidden />
              {tt("retake")}
            </Link>
          )}
          <Link href={buildingHref} className={buttonVariants({ variant: "ghost" })}>
            {t("toBuilding")}
          </Link>
          <Link href="/student" className={buttonVariants({ variant: "ghost" })}>
            <Map aria-hidden />
            {t("toCity")}
          </Link>
        </div>
      </Card>

      {attempt.status === "GRADED" && <AttemptRewards attemptId={attemptId} studentId={user.id} />}

      {attempt.status === "GRADED" && (
        <BuildingGrowth
          attemptId={attemptId}
          studentId={user.id}
          buildingKey={attempt.task.building.key as BuildingKey}
        />
      )}

      {/* manual work: show what was submitted */}
      {(type === "ESSAY" || type === "CREATIVE" || type === "AUDIO") && (
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">{t("yourWork")}</h2>
          {content.questions.map((q) =>
            type === "AUDIO" ? (
              answers[q.id]?.file ? (
                <audio key={q.id} controls src={`/api/files/${answers[q.id].file as string}`} className="w-full" />
              ) : (
                <p key={q.id} className="text-muted">
                  {t("noAnswer")}
                </p>
              )
            ) : (
              <p key={q.id} className="text-lg leading-relaxed whitespace-pre-line">
                {describeAnswer(type, q, answers[q.id]) ?? t("noAnswer")}
              </p>
            ),
          )}
        </Card>
      )}

      {/* closed tasks: per-question review */}
      {attempt.status === "GRADED" && type !== "ESSAY" && type !== "CREATIVE" && type !== "AUDIO" && (
        <section aria-labelledby="mistakes" className="grid gap-3">
          <h2 id="mistakes" className="text-xl font-extrabold">
            {t("mistakes")}
          </h2>
          {!reveal && results && (
            <p className="rounded-md bg-sun-100 px-4 py-3 text-sm font-semibold">{t("keysHidden")}</p>
          )}
          {!results ? (
            <Card tone="flat">
              <p className="text-muted">{t("noDetails")}</p>
            </Card>
          ) : (
            <ol className="grid gap-2.5">
              {content.questions.map((q, i) => {
                const r = results.find((x) => x.questionId === q.id);
                const status = !r || r.earned === 0 ? "wrong" : r.correct ? "correct" : "partly";
                const Icon = status === "correct" ? CircleCheck : status === "partly" ? CircleAlert : CircleX;
                const yours = describeAnswer(type, q, answers[q.id]);
                const right = describeAnswer(type, q, modelAnswer(type, key[q.id] ?? {}) as Record<string, unknown>);
                return (
                  <li key={q.id}>
                    <Card className="grid gap-2 p-4">
                      <p className="flex items-start gap-2 font-bold">
                        <Icon
                          className={cn(
                            "mt-0.5 size-5 shrink-0",
                            status === "correct"
                              ? "text-grass-700"
                              : status === "partly"
                                ? "text-sun-700"
                                : "text-coral-700",
                          )}
                          aria-hidden
                        />
                        <span>
                          <span className="sr-only">{t(status)}: </span>
                          {i + 1}. {q.prompt}
                        </span>
                      </p>
                      <p className="pl-7 text-base">
                        <span className="text-sm font-bold text-muted">{t("yourAnswer")}: </span>
                        {yours ?? <i className="text-muted">{t("noAnswer")}</i>}
                      </p>
                      {reveal && status !== "correct" && right && (
                        <p className="pl-7 text-base text-grass-700">
                          <span className="text-sm font-bold">{t("correctAnswer")}: </span>
                          {right}
                        </p>
                      )}
                    </Card>
                  </li>
                );
              })}
            </ol>
          )}
          {attempt.task.explanation && (
            <Card tone="tint" className="flex gap-3">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-sun-700" aria-hidden />
              <div>
                <p className="font-bold">{t("explanation")}</p>
                <p className="mt-1">{attempt.task.explanation}</p>
              </div>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

/** Score ring (design system: .score-ring). */
function ScoreRing({ score }: { score: number }) {
  const level = levelForScore(score);
  return (
    <div
      className="relative grid size-32 place-items-center rounded-full"
      style={{ background: `conic-gradient(var(--score-${level}) ${score * 10}%, var(--sz-ink-100) 0)` }}
      role="img"
      aria-label={`${score}/10`}
    >
      <span className="absolute inset-3 rounded-full bg-surface" aria-hidden />
      <span className="relative font-display text-4xl font-extrabold">
        {score}
        <small className="text-base text-muted">/10</small>
      </span>
    </div>
  );
}

/** "+1 level!" with the building rising — or the level it kept and what the next one needs. */
async function BuildingGrowth({
  attemptId,
  studentId,
  buildingKey,
}: {
  attemptId: string;
  studentId: string;
  buildingKey: BuildingKey;
}) {
  const t = await getTranslations("progress");
  const locale = (await getLocale()) as "kk" | "ru";
  const [event, progress] = await Promise.all([
    db.buildingLevelEvent.findFirst({ where: { attemptId }, select: { fromLevel: true, toLevel: true } }),
    db.buildingProgress.findFirst({
      where: { city: { studentId }, building: { key: buildingKey } },
      select: { level: true },
    }),
  ]);
  const level = progress?.level ?? 0;
  const name = BUILDINGS.find((b) => b.key === buildingKey)!.name[locale];
  const next = scoreForNextLevel(level);

  return (
    <Card className="grid items-center gap-4 p-5 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div
        className="sky-gradient rounded-md"
        dangerouslySetInnerHTML={{
          __html: buildingSvg(buildingKey, event ? event.toLevel : level, { animate: !!event, label: name }),
        }}
      />
      <div className="grid gap-1.5 text-center sm:text-left">
        {event ? (
          <>
            <p className="font-display text-3xl font-extrabold text-primary">
              {t("levelUp", { count: event.toLevel - event.fromLevel })}
            </p>
            <p className="text-lg font-bold">{t("newLevel", { building: name, level: event.toLevel })}</p>
          </>
        ) : (
          <p className="text-lg font-bold">
            {t("kept", { level })} · {name}
          </p>
        )}
        {next != null && <p className="text-sm text-muted">{t("next", { score: next })}</p>}
      </div>
    </Card>
  );
}

/** "+70 points · +15 materials · +1 star" and new badges earned by this attempt (spec §6). */
async function AttemptRewards({ attemptId, studentId }: { attemptId: string; studentId: string }) {
  const t = await getTranslations("rewards");
  const locale = (await getLocale()) as "kk" | "ru";
  const [ledger, notes] = await Promise.all([
    db.rewardTransaction.findMany({ where: { attemptId, studentId }, select: { kind: true, amount: true } }),
    db.notification.findMany({
      where: { recipientId: studentId, type: "ACHIEVEMENT_EARNED" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { payload: true },
    }),
  ]);
  const badgeKeys = notes
    .map((n) => n.payload as { achievement?: string; attemptId?: string })
    .filter((p) => p.attemptId === attemptId && p.achievement)
    .map((p) => p.achievement!);
  const badges = badgeKeys.length
    ? await db.achievement.findMany({
        where: { key: { in: badgeKeys } },
        select: { key: true, nameKk: true, nameRu: true, icon: true, color: true },
      })
    : [];
  if (ledger.length === 0 && badges.length === 0) return null;

  return (
    <Card className="grid gap-3 p-5">
      {ledger.length > 0 && (
        <p className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-display text-lg font-extrabold">
          {ledger.map((l) => (
            <span
              key={l.kind}
              className={
                l.kind === "POINTS" ? "text-sky-700" : l.kind === "MATERIALS" ? "text-coral-700" : "text-sun-700"
              }
            >
              +{l.amount} {t(`kindsShort.${l.kind}`)}
            </span>
          ))}
        </p>
      )}
      {badges.map((b) => (
        <div key={b.key} className="flex items-center justify-center gap-3">
          <BadgeMedal icon={b.icon} color={b.color} size="sm" />
          <p className="font-bold">
            {t("newBadge")}: {locale === "ru" ? b.nameRu : b.nameKk}
          </p>
        </div>
      ))}
    </Card>
  );
}
