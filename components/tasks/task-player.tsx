"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, CloudOff, Send, Timer, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveAnswers, submitAttempt } from "@/app/[locale]/student/task/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { TaskType } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import { isAnswered, type Answers } from "@/lib/tasks/answers";
import type { TaskTypeValue } from "@/lib/tasks/schemas";
import { cn } from "@/lib/utils";
import { QuestionInput, type Question } from "./inputs";
import { MaterialsList } from "./materials";
import type { TaskMaterial } from "@/lib/student/attempts";

type Props = {
  attemptId: string;
  title: string;
  instruction: string;
  type: TaskType;
  content: { passage?: string; source?: string; questions: Question[] };
  criteria: { id: string; title: string; max: number }[] | null;
  initialAnswers: Answers;
  /** ISO time when the time limit ends, or null */
  endsAt: string | null;
  backHref: string;
  materials?: TaskMaterial[];
};

type SaveState = "idle" | "saving" | "saved" | "offline";
const AUTOSAVE_MS = 1200;
const backupKey = (id: string) => `sz-attempt-${id}`;

/** Task player: one question per screen, autosave, timer (wireframe §3.4). */
export function TaskPlayer(props: Props) {
  const { attemptId, type, content, endsAt } = props;
  const t = useTranslations("task");
  const questions = content.questions;
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>(props.initialAnswers);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [confirming, setConfirming] = useState(false);
  const [submitting, startSubmit] = useTransition();
  const dirty = useRef(false);
  const submitted = useRef(false);

  const q = questions[index];
  const answeredCount = questions.filter((qq) => isAnswered(type as TaskTypeValue, answers[qq.id])).length;
  const last = index === questions.length - 1;

  // Answers typed while offline survive a reload: restore the device copy after mount.
  useEffect(() => {
    const backup = restoreBackup(attemptId);
    if (backup && JSON.stringify(backup) !== JSON.stringify(props.initialAnswers)) {
      dirty.current = true;
      setAnswers(backup); // eslint-disable-line react-hooks/set-state-in-effect -- one-time restore from localStorage
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // ---- autosave (server) + local backup (offline safety) -------------------
  useEffect(() => {
    if (!dirty.current) return;
    try {
      localStorage.setItem(backupKey(attemptId), JSON.stringify(answers));
    } catch {
      /* storage unavailable — the server copy still works */
    }
    const timer = setTimeout(async () => {
      setSaveState("saving");
      try {
        const res = await saveAnswers(attemptId, answers);
        setSaveState(res.ok ? "saved" : "offline");
      } catch {
        setSaveState("offline");
      }
    }, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [answers, attemptId]);

  const setAnswer = (qid: string, value: unknown) => {
    dirty.current = true;
    setAnswers((prev) => ({ ...prev, [qid]: value }));
  };

  const submit = useCallback(() => {
    if (submitted.current) return;
    submitted.current = true;
    startSubmit(async () => {
      try {
        localStorage.removeItem(backupKey(attemptId));
      } catch {
        /* ignore */
      }
      await submitAttempt(attemptId, answers); // redirects to the result page
    });
  }, [answers, attemptId]);

  // ---- timer ---------------------------------------------------------------
  const remaining = useRemaining(endsAt);
  useEffect(() => {
    if (remaining === 0) submit();
  }, [remaining, submit]);

  const timeUp = remaining === 0;

  return (
    <div className="mx-auto grid w-full max-w-3xl grid-cols-[minmax(0,1fr)] gap-4">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link
          href={props.backHref}
          aria-label={t("exit")}
          className="grid size-10 shrink-0 place-items-center rounded-full text-ink-500 hover:bg-cream"
        >
          <X className="size-5" aria-hidden />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold sm:text-xl">{props.title}</h1>
        <SaveIndicator state={saveState} />
        {remaining != null && (
          <span
            role="timer"
            aria-label={t("timeLeft")}
            suppressHydrationWarning
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-sm font-extrabold tabular-nums",
              remaining <= 60 ? "bg-coral-100 text-coral-700" : "bg-ink-100 text-ink-700",
            )}
          >
            <Timer className="size-4" aria-hidden />
            {formatTime(remaining)}
          </span>
        )}
      </div>

      {/* progress segments */}
      {questions.length > 1 && (
        <div className="grid gap-1.5">
          <ol className="flex gap-1.5">
            {questions.map((qq, i) => {
              const done = isAnswered(type as TaskTypeValue, answers[qq.id]);
              return (
                <li key={qq.id} className="flex-1">
                  <button
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={t("goTo", { n: i + 1 })}
                    aria-current={i === index ? "step" : undefined}
                    className={cn(
                      "block h-2.5 w-full cursor-pointer rounded-full transition-colors",
                      done ? "bg-primary" : "bg-ink-100",
                      i === index && "ring-2 ring-primary ring-offset-2",
                    )}
                  />
                </li>
              );
            })}
          </ol>
          <p className="flex justify-between text-sm font-bold text-muted">
            <span>{t("question", { n: index + 1, total: questions.length })}</span>
            <span>{t("answered", { count: answeredCount, total: questions.length })}</span>
          </p>
        </div>
      )}

      {props.materials && props.materials.length > 0 && index === 0 && <MaterialsList materials={props.materials} />}

      {/* passage (text analysis, character identification, creative work) */}
      {(content.passage || content.source) && (
        <details open className="rounded-lg border border-line bg-cream p-4">
          <summary className="flex cursor-pointer items-center gap-2 font-bold">
            <BookOpen className="size-4 text-primary-edge" aria-hidden />
            {content.source ?? t("passage")}
          </summary>
          {content.passage && <p className="mt-3 text-lg leading-relaxed">{content.passage}</p>}
        </details>
      )}

      {/* question */}
      <Card className="grid gap-4 p-5 sm:p-6">
        {index === 0 && <p className="text-sm font-semibold text-muted">{props.instruction}</p>}
        <h2 className="text-xl leading-snug font-bold" id={`q-${q.id}`}>
          {q.prompt}
        </h2>
        <div aria-labelledby={`q-${q.id}`}>
          <QuestionInput
            key={q.id}
            type={type}
            question={q}
            answer={answers[q.id] as Record<string, unknown> | undefined}
            onChange={(v) => setAnswer(q.id, v)}
            attemptId={attemptId}
          />
        </div>
        {props.criteria && (
          <details className="rounded-md bg-violet-100 p-3 text-sm">
            <summary className="cursor-pointer font-bold text-violet-700">{t("criteria")}</summary>
            <ul className="mt-2 grid gap-1">
              {props.criteria.map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span>{c.title}</span>
                  <b>{t("points", { max: c.max })}</b>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* navigation */}
      <div className="flex items-center gap-3">
        {index > 0 && (
          <Button variant="ghost" onClick={() => setIndex((i) => i - 1)}>
            <ArrowLeft aria-hidden />
            {t("prev")}
          </Button>
        )}
        <div className="ml-auto">
          {last ? (
            <Button
              size="lg"
              variant="accent"
              disabled={submitting || timeUp}
              onClick={() => (answeredCount < questions.length ? setConfirming(true) : submit())}
            >
              <Send aria-hidden />
              {t("submit")}
            </Button>
          ) : (
            <Button size="lg" onClick={() => setIndex((i) => i + 1)}>
              {t("next")}
              <ArrowRight aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {timeUp && (
        <p role="alert" className="rounded-md bg-coral-100 px-4 py-3 font-bold text-coral-700">
          {t("timeUp")}
        </p>
      )}

      {confirming && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-50 grid place-items-center bg-ink-900/40 p-4"
        >
          <Card className="grid w-full max-w-sm gap-4">
            <h2 id="confirm-title" className="text-xl font-extrabold">
              {t("confirmTitle")}
            </h2>
            <p className="font-semibold text-coral-700">
              {t("unanswered", { count: questions.length - answeredCount })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirming(false)} autoFocus>
                {t("keepWorking")}
              </Button>
              <Button variant="accent" onClick={submit} disabled={submitting}>
                {t("confirmSubmit")}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const t = useTranslations("task");
  if (state === "idle") return null;
  return (
    <span role="status" className="hidden items-center gap-1 text-xs font-bold text-muted sm:inline-flex">
      {state === "offline" ? (
        <CloudOff className="size-4 text-coral-700" aria-hidden />
      ) : (
        <Check className="size-4" aria-hidden />
      )}
      {state === "saving" ? t("saving") : state === "saved" ? t("saved") : t("offline")}
    </span>
  );
}

/** Seconds left until `endsAt` (ticks every second), or null when there is no limit. */
function useRemaining(endsAt: string | null) {
  const calc = useCallback(
    () => (endsAt ? Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000)) : null),
    [endsAt],
  );
  const [left, setLeft] = useState<number | null>(calc);
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setLeft(calc()), 1000);
    return () => clearInterval(id);
  }, [endsAt, calc]);
  return left;
}

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function restoreBackup(attemptId: string): Answers | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(backupKey(attemptId));
    return raw ? (JSON.parse(raw) as Answers) : null;
  } catch {
    return null;
  }
}
