"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Fragment, useRef, useState } from "react";
import type { TaskType } from "@/generated/prisma/enums";
import { countWords } from "@/lib/tasks/answers";
import { cn } from "@/lib/utils";
import { AudioRecorder } from "./audio-recorder";

type Option = { id: string; text: string };
export type Question = { id: string; prompt: string } & Record<string, unknown>;
type A = Record<string, unknown> | undefined;
type Props = { type: TaskType; question: Question; answer: A; onChange: (a: unknown) => void; attemptId: string };

/** One input per task type (docs/design/03-ux-wireframes.md §3.4). Task content is Russian. */
export function QuestionInput(props: Props) {
  const { type } = props;
  switch (type) {
    case "SINGLE_CHOICE":
    case "CHARACTER_ID":
      return <Choice {...props} multiple={false} />;
    case "MULTIPLE_CHOICE":
      return <Choice {...props} multiple />;
    case "TEXT_ANALYSIS":
      return props.question.options ? <Choice {...props} multiple={false} /> : <ShortText {...props} />;
    case "MATCHING":
      return <Matching {...props} />;
    case "FILL_GAPS":
      return <FillGaps {...props} />;
    case "WORD_ORDER":
      return <WordOrder {...props} />;
    case "ERROR_CORRECTION":
      return <ErrorCorrection {...props} />;
    case "PUNCTUATION":
      return <Punctuation {...props} />;
    case "ESSAY":
    case "CREATIVE":
      return <LongText {...props} />;
    case "AUDIO":
      return <AudioRecorder {...props} />;
  }
}

const hint = "mb-3 text-sm font-bold text-muted";

/* ------------------------------------------------------------- choice cards */
function Choice({ question, answer, onChange, multiple }: Props & { multiple: boolean }) {
  const t = useTranslations("task.in");
  const options = question.options as Option[];
  const picked: string[] = multiple
    ? ((answer?.choices as string[]) ?? [])
    : answer?.choice
      ? [answer.choice as string]
      : [];
  const toggle = (id: string) => {
    if (!multiple) return onChange({ choice: id });
    onChange({ choices: picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id] });
  };
  return (
    <fieldset>
      <legend className={hint}>{multiple ? t("chooseMany") : t("chooseOne")}</legend>
      <div className="grid gap-2.5">
        {options.map((o) => {
          const on = picked.includes(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                "flex min-h-14 cursor-pointer items-center gap-3 rounded-md border-2 bg-surface px-4 py-3 text-lg transition-colors has-focus-visible:outline-3 has-focus-visible:outline-focus",
                on ? "border-primary bg-sky-50" : "border-ink-100 hover:border-sky-300",
              )}
            >
              <input
                type={multiple ? "checkbox" : "radio"}
                name={question.id}
                checked={on}
                onChange={() => toggle(o.id)}
                className="sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  "grid size-6 shrink-0 place-items-center border-2",
                  multiple ? "rounded-md" : "rounded-full",
                  on ? "border-primary bg-primary text-white" : "border-ink-300",
                )}
              >
                {on && <Check className="size-4" strokeWidth={3} />}
              </span>
              <span>{o.text}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ----------------------------------------------------------------- matching */
function Matching({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  const left = question.left as Option[];
  const right = question.right as Option[];
  const pairs = (answer?.pairs as Record<string, string>) ?? {};
  return (
    <div>
      <p className={hint}>{t("matchHint")}</p>
      <div className="grid gap-2.5">
        {left.map((l) => (
          <div
            key={l.id}
            className="grid items-center gap-2 rounded-md border-2 border-ink-100 bg-surface p-3 sm:grid-cols-[1fr_1fr]"
          >
            <label htmlFor={`m-${l.id}`} className="text-lg font-bold">
              {l.text}
            </label>
            <select
              id={`m-${l.id}`}
              value={pairs[l.id] ?? ""}
              onChange={(e) => onChange({ pairs: { ...pairs, [l.id]: e.target.value } })}
              className={cn(
                "min-h-12 w-full rounded-md border-2 bg-surface px-3 text-base font-semibold focus:border-primary focus:outline-none",
                pairs[l.id] ? "border-primary" : "border-ink-100",
              )}
            >
              <option value="">{t("matchPick")}</option>
              {right.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.text}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- fill gaps */
function FillGaps({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  const gaps = (answer?.gaps as Record<string, string>) ?? {};
  const parts = String(question.text).split(/\[\[([^\]]+)\]\]/g); // [text, gapId, text, gapId, …]
  const gapIds = parts.filter((_, i) => i % 2 === 1);
  const [active, setActive] = useState(gapIds[0]);
  const bank = (question.bank as string[] | undefined) ?? [];
  const set = (g: string, v: string) => onChange({ gaps: { ...gaps, [g]: v } });
  let n = 0;
  return (
    <div>
      <p className={hint}>{t("fillHint")}</p>
      <p className="rounded-md border-2 border-ink-100 bg-surface p-4 text-xl leading-loose">
        {parts.map((part, i) =>
          i % 2 === 0 ? (
            <Fragment key={i}>{part}</Fragment>
          ) : (
            <input
              key={i}
              aria-label={t("gap", { n: ++n })}
              value={gaps[part] ?? ""}
              onFocus={() => setActive(part)}
              onChange={(e) => set(part, e.target.value)}
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              size={Math.max(2, (gaps[part] ?? "").length + 1)}
              className={cn(
                "mx-0.5 inline-block min-w-12 rounded-md border-b-4 bg-sky-50 px-1.5 text-center font-bold text-sky-700 focus:outline-none",
                active === part ? "border-primary" : "border-sky-300",
              )}
            />
          ),
        )}
      </p>
      {bank.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-xs font-bold text-muted">{t("bank")}</p>
          <div className="flex flex-wrap gap-2">
            {bank.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => active && set(active, w)}
                className="min-h-11 min-w-11 cursor-pointer rounded-md border-2 border-ink-100 bg-surface px-4 text-lg font-bold hover:border-primary"
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- word order */
function WordOrder({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  const tokens = question.tokens as Option[];
  const order = (answer?.order as string[]) ?? [];
  const pool = tokens.filter((tk) => !order.includes(tk.id));
  const text = (id: string) => tokens.find((tk) => tk.id === id)?.text ?? "";
  const chip =
    "min-h-12 cursor-pointer rounded-md border-2 px-4 text-lg font-bold transition-transform active:scale-95";
  return (
    <div className="grid gap-4">
      <p className={hint}>{t("orderHint")}</p>
      <div>
        <p className="mb-1.5 text-xs font-bold text-muted">{t("orderAnswer")}</p>
        <div className="flex min-h-16 flex-wrap items-center gap-2 rounded-md border-2 border-dashed border-primary bg-sky-50 p-2.5">
          {order.length === 0 && <span className="px-2 text-muted">{t("orderEmpty")}</span>}
          {order.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange({ order: order.filter((o) => o !== id) })}
              className={cn(chip, "border-primary bg-surface")}
            >
              {text(id)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-bold text-muted">{t("orderPool")}</p>
        <div className="flex min-h-14 flex-wrap gap-2">
          {pool.map((tk) => (
            <button
              key={tk.id}
              type="button"
              onClick={() => onChange({ order: [...order, tk.id] })}
              className={cn(chip, "border-ink-100 bg-surface hover:border-primary")}
            >
              {tk.text}
            </button>
          ))}
        </div>
      </div>
      {order.length > 0 && (
        <button
          type="button"
          onClick={() => onChange({ order: [] })}
          className="justify-self-start text-sm font-bold text-primary-edge"
        >
          {t("orderClear")}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- error correction */
function ErrorCorrection({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  const tokens = question.tokens as string[];
  const fixes = (answer?.fixes as Record<string, string>) ?? {};
  const [editing, setEditing] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setFix = (i: number, value: string | null) => {
    const next = { ...fixes };
    if (value === null || value === tokens[i]) delete next[i];
    else next[i] = value;
    onChange({ fixes: next });
  };

  return (
    <div>
      <p className={hint}>{t("errorHint")}</p>
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-md border-2 border-ink-100 bg-surface p-4 text-xl">
        {tokens.map((word, i) =>
          editing === i ? (
            <span key={i} className="inline-flex items-center gap-1">
              <input
                ref={inputRef}
                autoFocus
                defaultValue={fixes[i] ?? word}
                aria-label={t("errorEdit", { word })}
                autoCapitalize="none"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setFix(i, e.currentTarget.value.trim());
                    setEditing(null);
                  }
                  if (e.key === "Escape") setEditing(null);
                }}
                onBlur={(e) => {
                  setFix(i, e.currentTarget.value.trim());
                  setEditing(null);
                }}
                size={Math.max(4, word.length + 2)}
                className="rounded-md border-2 border-primary px-1.5 py-0.5 font-bold focus:outline-none"
              />
            </span>
          ) : (
            <span key={i} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setEditing(i)}
                aria-label={fixes[i] != null ? `${word} → ${fixes[i]}` : t("errorEdit", { word })}
                className={cn(
                  "cursor-pointer rounded-md px-1 py-0.5 hover:bg-sky-50",
                  fixes[i] != null && "bg-sun-100 font-bold text-sun-700 underline decoration-wavy",
                )}
              >
                {fixes[i] ?? word}
              </button>
              {fixes[i] != null && (
                <button
                  type="button"
                  onClick={() => setFix(i, null)}
                  aria-label={t("errorReset")}
                  title={t("errorReset")}
                  className="ml-0.5 grid size-6 cursor-pointer place-items-center rounded-full text-ink-500 hover:bg-ink-100"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                </button>
              )}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- punctuation */
function Punctuation({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  const tokens = question.tokens as string[];
  const offered = question.marks as string[];
  const marks = (answer?.marks as Record<string, string>) ?? {};
  const cycle = (i: number) => {
    const cur = marks[i];
    const idx = cur ? offered.indexOf(cur) : -1;
    const nextMark = idx + 1 < offered.length ? offered[idx + 1] : null;
    const next = { ...marks };
    if (nextMark) next[i] = nextMark;
    else delete next[i];
    onChange({ marks: next });
  };
  return (
    <div>
      <p className={hint}>{t("punctHint")}</p>
      <p className="flex flex-wrap items-center gap-y-2 rounded-md border-2 border-ink-100 bg-surface p-4 text-xl">
        {tokens.map((word, i) => (
          <Fragment key={i}>
            <span>{word}</span>
            {i < tokens.length - 1 && (
              <button
                type="button"
                onClick={() => cycle(i)}
                aria-label={t("gapMark", { n: i + 1, mark: marks[i] ?? t("gapEmpty") })}
                className={cn(
                  "mx-1 grid h-10 min-w-7 cursor-pointer place-items-center rounded-md font-display text-2xl font-extrabold transition-colors",
                  marks[i]
                    ? "bg-sun-100 px-1.5 text-coral-700"
                    : "border-2 border-dashed border-ink-300 text-transparent hover:border-primary",
                )}
              >
                {marks[i] ?? "·"}
              </button>
            )}
          </Fragment>
        ))}
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- text inputs */
function ShortText({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  return (
    <div>
      <label htmlFor={`t-${question.id}`} className={cn(hint, "block")}>
        {t("textAnswer")}
      </label>
      <input
        id={`t-${question.id}`}
        value={(answer?.text as string) ?? ""}
        onChange={(e) => onChange({ text: e.target.value })}
        autoComplete="off"
        className="min-h-14 w-full rounded-md border-2 border-ink-100 bg-surface px-4 text-lg font-semibold focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function LongText({ question, answer, onChange }: Props) {
  const t = useTranslations("task.in");
  const text = (answer?.text as string) ?? "";
  const words = countWords(text);
  const min = question.minWords as number | undefined;
  const max = question.maxWords as number | undefined;
  const ok = (!min || words >= min) && (!max || words <= max);
  return (
    <div>
      <label htmlFor={`e-${question.id}`} className={cn(hint, "block")}>
        {min && max ? t("wordsRange", { min, max }) : min ? t("minWords", { min }) : t("textAnswer")}
      </label>
      <textarea
        id={`e-${question.id}`}
        value={text}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={12}
        className="w-full rounded-md border-2 border-ink-100 bg-surface p-4 text-lg leading-relaxed focus:border-primary focus:outline-none"
      />
      <p className={cn("mt-1.5 flex items-center gap-1.5 text-sm font-bold", ok ? "text-grass-700" : "text-muted")}>
        {ok && words > 0 ? (
          <Check className="size-4" aria-hidden />
        ) : words > 0 && max && words > max ? (
          <X className="size-4" aria-hidden />
        ) : null}
        {t("words", { count: words })}
      </p>
    </div>
  );
}
