"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { QuestionInput, type Question } from "@/components/tasks/inputs";
import { Button } from "@/components/ui/button";
import type { TaskType } from "@/generated/prisma/enums";
import { gradeTask, type GradeResult } from "@/lib/grading/grade";
import type { TaskTypeValue } from "@/lib/tasks/schemas";

/** "Preview as student": the real inputs, plus a check button that runs the real grader. */
export function TaskPreview({
  type,
  content,
  answerKey,
}: {
  type: TaskType;
  content: { passage?: string; source?: string; questions: Question[] };
  answerKey: Record<string, Record<string, unknown>> | null;
}) {
  const t = useTranslations("teacher.editor");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<GradeResult | null>(null);

  return (
    <div className="grid gap-4">
      {(content.passage || content.source) && (
        <div className="rounded-lg bg-cream p-4">
          {content.source && <p className="mb-1 font-bold">{content.source}</p>}
          {content.passage && <p className="text-lg leading-relaxed">{content.passage}</p>}
        </div>
      )}
      {content.questions.map((q, i) => {
        const r = result?.results.find((x) => x.questionId === q.id);
        return (
          <div key={q.id} className="grid gap-3 rounded-lg border border-line bg-surface p-4">
            <p className="flex items-start gap-2 text-lg font-bold">
              {r &&
                (r.correct ? (
                  <CircleCheck className="mt-1 size-5 text-grass-700" aria-hidden />
                ) : (
                  <CircleX className="mt-1 size-5 text-coral-700" aria-hidden />
                ))}
              {i + 1}. {q.prompt}
            </p>
            <QuestionInput
              type={type}
              question={q}
              answer={answers[q.id] as Record<string, unknown> | undefined}
              onChange={(v) => {
                setAnswers((a) => ({ ...a, [q.id]: v }));
                setResult(null);
              }}
              attemptId="preview"
            />
          </div>
        );
      })}
      {answerKey ? (
        <div className="flex items-center gap-3">
          <Button
            variant="accent"
            onClick={() => setResult(gradeTask(type as TaskTypeValue, content, answerKey, answers))}
          >
            {t("check")}
          </Button>
          {result && <span className="font-display text-2xl font-extrabold">{result.score}/10</span>}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("manualPreview")}</p>
      )}
    </div>
  );
}
