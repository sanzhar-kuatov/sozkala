"use client";

import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input, Textarea } from "@/components/ui/field";
import type { TaskType } from "@/generated/prisma/enums";
import { PUNCTUATION_MARKS, type QuestionDraft } from "@/lib/tasks/authoring";
import { cn } from "@/lib/utils";

type Props = { type: TaskType; q: QuestionDraft; onChange: (q: QuestionDraft) => void; index: number };

const small = "min-h-10 py-2";

/** Type-specific editor for one question (wireframe §4.2 step 2). */
export function QuestionEditor({ type, q, onChange, index }: Props) {
  const t = useTranslations("teacher.editor");
  const set = (patch: Partial<QuestionDraft>) => onChange({ ...q, ...patch });
  const id = (name: string) => `q${index}-${name}`;

  return (
    <div className="grid gap-3">
      <label className="grid gap-1 text-sm font-extrabold" htmlFor={id("prompt")}>
        {t("prompt")}
        <Textarea
          id={id("prompt")}
          value={q.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          className="min-h-16"
        />
      </label>

      {(type === "SINGLE_CHOICE" ||
        type === "CHARACTER_ID" ||
        type === "MULTIPLE_CHOICE" ||
        type === "TEXT_ANALYSIS") && (
        <>
          {type === "TEXT_ANALYSIS" && (
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={!!q.shortAnswer}
                onChange={(e) => set({ shortAnswer: e.target.checked })}
                className="size-4 accent-(--color-primary)"
              />
              {t("shortAnswer")}
            </label>
          )}
          {type === "TEXT_ANALYSIS" && q.shortAnswer ? (
            <label className="grid gap-1 text-sm font-extrabold">
              {t("accepted")}
              <Input
                value={q.accepted ?? ""}
                onChange={(e) => set({ accepted: e.target.value })}
                placeholder="120 / сто двадцать"
              />
              <span className="text-xs font-semibold text-muted">{t("acceptedHint")}</span>
            </label>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-extrabold">
                {type === "MULTIPLE_CHOICE" ? t("optionsMulti") : t("optionsSingle")}
              </legend>
              {(q.options ?? []).map((o, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type={type === "MULTIPLE_CHOICE" ? "checkbox" : "radio"}
                    name={id("correct")}
                    checked={o.correct}
                    aria-label={t("markCorrect", { n: i + 1 })}
                    onChange={() =>
                      set({
                        options: (q.options ?? []).map((x, j) =>
                          type === "MULTIPLE_CHOICE"
                            ? j === i
                              ? { ...x, correct: !x.correct }
                              : x
                            : { ...x, correct: j === i },
                        ),
                      })
                    }
                    className="size-5 shrink-0 accent-(--color-success)"
                  />
                  <Input
                    value={o.text}
                    aria-label={t("option", { n: i + 1 })}
                    onChange={(e) =>
                      set({ options: (q.options ?? []).map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })
                    }
                    className={cn(small, o.correct && "border-grass-500")}
                  />
                  <RemoveButton
                    label={t("removeOption")}
                    disabled={(q.options ?? []).length <= 2}
                    onClick={() => set({ options: (q.options ?? []).filter((_, j) => j !== i) })}
                  />
                </div>
              ))}
              <AddButton
                label={t("addOption")}
                onClick={() => set({ options: [...(q.options ?? []), { text: "", correct: false }] })}
              />
            </fieldset>
          )}
        </>
      )}

      {type === "MATCHING" && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-extrabold">{t("pairs")}</legend>
          {(q.pairs ?? []).map((p, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
              <Input
                value={p.left}
                aria-label={t("left", { n: i + 1 })}
                placeholder={t("leftPlaceholder")}
                className={small}
                onChange={(e) =>
                  set({ pairs: (q.pairs ?? []).map((x, j) => (j === i ? { ...x, left: e.target.value } : x)) })
                }
              />
              <Input
                value={p.right}
                aria-label={t("right", { n: i + 1 })}
                placeholder={t("rightPlaceholder")}
                className={small}
                onChange={(e) =>
                  set({ pairs: (q.pairs ?? []).map((x, j) => (j === i ? { ...x, right: e.target.value } : x)) })
                }
              />
              <RemoveButton
                label={t("removePair")}
                disabled={(q.pairs ?? []).length <= 2}
                onClick={() => set({ pairs: (q.pairs ?? []).filter((_, j) => j !== i) })}
              />
            </div>
          ))}
          <p className="text-xs font-semibold text-muted">{t("pairsHint")}</p>
          <AddButton
            label={t("addPair")}
            onClick={() => set({ pairs: [...(q.pairs ?? []), { left: "", right: "" }] })}
          />
        </fieldset>
      )}

      {type === "FILL_GAPS" && (
        <>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("gapText")}
            <Textarea
              value={q.gapText ?? ""}
              onChange={(e) => set({ gapText: e.target.value })}
              placeholder="пр[е]красный день, пр[и]ехать в город"
              className="min-h-20 font-mono"
            />
            <span className="text-xs font-semibold text-muted">{t("gapHint")}</span>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("bank")}
            <Input
              value={q.bank ?? ""}
              onChange={(e) => set({ bank: e.target.value })}
              placeholder="е, и"
              className={small}
            />
          </label>
        </>
      )}

      {(type === "WORD_ORDER" || type === "ERROR_CORRECTION" || type === "PUNCTUATION") && (
        <label className="grid gap-1 text-sm font-extrabold">
          {t(`sentence.${type}`)}
          <Textarea
            value={q.sentence ?? ""}
            onChange={(e) => set({ sentence: e.target.value })}
            className="min-h-16 font-mono"
            placeholder={
              type === "ERROR_CORRECTION"
                ? "Вчера мы {видили|видели} картины."
                : type === "PUNCTUATION"
                  ? "Когда солнце село, мы пошли домой."
                  : "Ранней осенью лес становится золотым."
            }
          />
          <span className="text-xs font-semibold text-muted">{t(`sentenceHint.${type}`)}</span>
        </label>
      )}

      {type === "PUNCTUATION" && (
        <fieldset>
          <legend className="mb-1 text-sm font-extrabold">{t("marks")}</legend>
          <div className="flex flex-wrap gap-2">
            {PUNCTUATION_MARKS.map((m) => {
              const on = (q.marks ?? []).includes(m);
              return (
                <label
                  key={m}
                  className={cn(
                    "grid size-10 cursor-pointer place-items-center rounded-md border-2 font-display text-xl font-extrabold",
                    on ? "border-primary bg-sky-50" : "border-ink-100",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={on}
                    onChange={() =>
                      set({ marks: on ? (q.marks ?? []).filter((x) => x !== m) : [...(q.marks ?? []), m] })
                    }
                  />
                  {m}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {(type === "ESSAY" || type === "CREATIVE") && (
        <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
          <label className="grid gap-1 text-sm font-extrabold">
            {t("minWords")}
            <Input
              type="number"
              min={0}
              max={2000}
              value={q.minWords ?? ""}
              className={small}
              onChange={(e) => set({ minWords: e.target.value ? Number(e.target.value) : undefined })}
            />
          </label>
          {type === "ESSAY" && (
            <label className="grid gap-1 text-sm font-extrabold">
              {t("maxWords")}
              <Input
                type="number"
                min={0}
                max={5000}
                value={q.maxWords ?? ""}
                className={small}
                onChange={(e) => set({ maxWords: e.target.value ? Number(e.target.value) : undefined })}
              />
            </label>
          )}
        </div>
      )}

      {type === "AUDIO" && (
        <>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("readText")}
            <Textarea
              value={q.readText ?? ""}
              onChange={(e) => set({ readText: e.target.value })}
              className="min-h-20"
            />
          </label>
          <label className="grid gap-1 text-sm font-extrabold sm:max-w-40">
            {t("maxSeconds")}
            <Input
              type="number"
              min={10}
              max={600}
              value={q.maxSeconds ?? 180}
              className={small}
              onChange={(e) => set({ maxSeconds: Number(e.target.value) || 180 })}
            />
          </label>
        </>
      )}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex cursor-pointer items-center gap-1.5 justify-self-start text-sm font-bold text-primary-edge"
    >
      <Plus className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function RemoveButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-500 hover:bg-coral-100 hover:text-coral-700 disabled:opacity-30"
    >
      <Trash2 className="size-4" aria-hidden />
    </button>
  );
}
