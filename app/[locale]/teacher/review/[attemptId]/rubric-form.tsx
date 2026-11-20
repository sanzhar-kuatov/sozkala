"use client";

import { Check, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { levelForScore } from "@/lib/domain/levels";
import { cn } from "@/lib/utils";
import { gradeAttempt, returnAttempt, type ReviewState } from "../actions";

type Criterion = { id: string; title: string; max: number };

/** Rubric (0…max per criterion, half points allowed) with live total and building-level preview. */
export function RubricForm({
  attemptId,
  criteria,
  buildingName,
  currentLevel,
}: {
  attemptId: string;
  criteria: Criterion[];
  buildingName: string;
  currentLevel: number;
}) {
  const t = useTranslations("review");
  const [points, setPoints] = useState<Record<string, number>>(() =>
    Object.fromEntries(criteria.map((c) => [c.id, 0])),
  );
  const [gradeState, grade, grading] = useActionState<ReviewState, FormData>(
    gradeAttempt.bind(null, attemptId),
    undefined,
  );
  const [returnState, giveBack, returning] = useActionState<ReviewState, FormData>(
    returnAttempt.bind(null, attemptId),
    undefined,
  );
  const total = Math.min(
    10,
    Object.values(points).reduce((s, p) => s + p, 0),
  );
  const previewLevel = Math.max(currentLevel, levelForScore(total));
  const error = gradeState?.error ?? returnState?.error;
  const busy = grading || returning;

  return (
    <form className="grid gap-4">
      <h2 className="text-lg font-bold">{t("criteria")}</h2>
      {criteria.map((c) => (
        <fieldset key={c.id} className="grid gap-2">
          <legend className="mb-1 flex w-full justify-between text-sm font-bold">
            <span>{c.title}</span>
            <span className="text-muted">0–{c.max}</span>
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: c.max * 2 + 1 }, (_, i) => i / 2).map((v) => (
              <label
                key={v}
                className={cn(
                  "grid h-10 min-w-10 cursor-pointer place-items-center rounded-md border-2 px-2 font-display font-extrabold has-focus-visible:outline-3 has-focus-visible:outline-focus",
                  points[c.id] === v
                    ? "border-primary bg-primary text-white"
                    : "border-ink-100 bg-surface hover:border-sky-300",
                  !Number.isInteger(v) && "min-w-8 text-xs",
                )}
              >
                <input
                  type="radio"
                  name={`c_${c.id}`}
                  value={v}
                  checked={points[c.id] === v}
                  onChange={() => setPoints((p) => ({ ...p, [c.id]: v }))}
                  className="sr-only"
                />
                {Number.isInteger(v) ? v : `${Math.floor(v) || ""}½`}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center justify-between rounded-md bg-cream px-4 py-3">
        <span className="font-bold">{t("total")}</span>
        <span className="font-display text-2xl font-extrabold">{total}/10</span>
      </div>
      <p className="text-sm font-semibold text-ink-700">
        {t("preview", { level: previewLevel, name: buildingName })} · {t("currentLevel", { level: currentLevel })}
      </p>

      <div className="grid gap-1.5">
        <label htmlFor="feedback" className="text-sm font-extrabold">
          {t("feedback")}
        </label>
        <Textarea id="feedback" name="feedback" placeholder={t("feedbackHint")} maxLength={2000} />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2.5 text-sm font-bold text-coral-700">
          {t(`errors.${error}`)}
        </p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="submit" formAction={giveBack} variant="ghost" disabled={busy}>
          <RotateCcw aria-hidden />
          {t("return")}
        </Button>
        <Button type="submit" formAction={grade} variant="success" disabled={busy}>
          <Check aria-hidden />
          {t("grade")}
        </Button>
      </div>
    </form>
  );
}
