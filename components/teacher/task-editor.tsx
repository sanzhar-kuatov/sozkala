"use client";

import { ArrowDown, ArrowUp, Eye, Lock, Pencil, Plus, Save, Send, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { saveTask, type SaveTaskResult } from "@/app/[locale]/teacher/tasks/actions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TaskType } from "@/generated/prisma/enums";
import { useRouter } from "@/i18n/navigation";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { blankQuestion, defaultCriteria, DraftInvalid, fromDraft, type TaskDraft } from "@/lib/tasks/authoring";
import { MANUAL_TYPES, type TaskTypeValue } from "@/lib/tasks/schemas";
import { cn } from "@/lib/utils";
import { QuestionEditor } from "./question-editor";
import { TaskPreview } from "./task-preview";

export type EditorMeta = {
  title: string;
  instruction: string;
  type: TaskTypeValue;
  building: BuildingKey;
  topicId: string | null;
  /** School year 5–11: only classes and students of this grade can get the task. */
  grade: number;
  difficulty: number;
  timeLimitMin: number | null;
  maxAttempts: number | null;
  explanation: string;
};

type Props = {
  taskId: string | null;
  initialMeta: EditorMeta;
  initialDraft: TaskDraft;
  topics: { id: string; title: string; building: string | null }[];
  locked: boolean;
};

const TYPES = Object.values(TaskType) as TaskTypeValue[];
const PASSAGE_TYPES: TaskTypeValue[] = [
  "TEXT_ANALYSIS",
  "CHARACTER_ID",
  "CREATIVE",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
];

/** Task builder for all 12 types (wireframe §4.2). */
export function TaskEditor({ taskId, initialMeta, initialDraft, topics, locked }: Props) {
  const t = useTranslations("teacher.editor");
  const tt = useTranslations("teacher.types");
  const locale = useLocale() as "kk" | "ru";
  const router = useRouter();
  const [meta, setMeta] = useState(initialMeta);
  const [draft, setDraft] = useState(initialDraft);
  const [preview, setPreview] = useState(false);
  const [result, setResult] = useState<SaveTaskResult | null>(null);
  const [saving, startSaving] = useTransition();
  const manual = MANUAL_TYPES.includes(meta.type);

  const setM = (patch: Partial<EditorMeta>) => setMeta((m) => ({ ...m, ...patch }));
  const setQuestion = (i: number, q: TaskDraft["questions"][number]) =>
    setDraft((d) => ({ ...d, questions: d.questions.map((x, j) => (j === i ? q : x)) }));
  const move = (i: number, dir: -1 | 1) =>
    setDraft((d) => {
      const qs = [...d.questions];
      [qs[i], qs[i + dir]] = [qs[i + dir], qs[i]];
      return { ...d, questions: qs };
    });

  const changeType = (type: TaskTypeValue) => {
    if (type === meta.type) return;
    const hasContent = draft.questions.some((q) => q.prompt.trim());
    if (hasContent && !confirm(t("changeTypeConfirm"))) return;
    setM({ type });
    setDraft((d) => ({
      ...d,
      questions: [blankQuestion(type)],
      criteria: d.criteria.length ? d.criteria : defaultCriteria(),
    }));
  };

  // Live validation + preview content (same converter as the server).
  const compiled = useMemo(() => {
    try {
      return { ok: true as const, ...fromDraft(meta.type, draft) };
    } catch (e) {
      return { ok: false as const, error: e instanceof DraftInvalid ? e : null };
    }
  }, [meta.type, draft]);

  const save = (publish: boolean) =>
    startSaving(async () => {
      const res = await saveTask(taskId, { meta, draft, publish });
      setResult(res);
      if (res.ok && !taskId) router.replace(`/teacher/tasks/${res.id}`);
      else if (res.ok) router.refresh();
    });

  const errorText = (r: SaveTaskResult | null) => {
    if (!r || r.ok) return null;
    const prefix = r.question != null ? `${t("questionN", { n: r.question + 1 })}: ` : "";
    return prefix + t(`errors.${r.error}`) + (r.detail ? ` (${r.detail})` : "");
  };
  const rubricSum = draft.criteria.reduce((s, c) => s + (Number(c.max) || 0), 0);

  return (
    <div className="grid gap-4">
      {/* 1 · basics */}
      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("step1")}</h2>
        <label className="grid gap-1 text-sm font-extrabold">
          {t("title")}
          <Input value={meta.title} onChange={(e) => setM({ title: e.target.value })} maxLength={160} />
        </label>
        <label className="grid gap-1 text-sm font-extrabold">
          {t("instruction")}
          <Textarea
            value={meta.instruction}
            onChange={(e) => setM({ instruction: e.target.value })}
            className="min-h-16"
            maxLength={1000}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm font-extrabold">
            {t("type")}
            <Select value={meta.type} onChange={(e) => changeType(e.target.value as TaskTypeValue)} disabled={locked}>
              {TYPES.map((type) => (
                <option key={type} value={type}>
                  {tt(type)}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("building")}
            <Select value={meta.building} onChange={(e) => setM({ building: e.target.value as BuildingKey })}>
              {BUILDINGS.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name[locale]}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("topic")}
            <Select value={meta.topicId ?? ""} onChange={(e) => setM({ topicId: e.target.value || null })}>
              <option value="">{t("noTopic")}</option>
              {topics
                .filter((tp) => !tp.building || tp.building === meta.building)
                .map((tp) => (
                  <option key={tp.id} value={tp.id}>
                    {tp.title}
                  </option>
                ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("difficulty")}
            <Select value={meta.difficulty} onChange={(e) => setM({ difficulty: Number(e.target.value) })}>
              {[1, 2, 3].map((d) => (
                <option key={d} value={d}>
                  {"★".repeat(d)}
                  {"☆".repeat(3 - d)}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-sm font-extrabold">
            {t("grade")}
            <Select value={meta.grade} onChange={(e) => setM({ grade: Number(e.target.value) })}>
              {[5, 6, 7, 8, 9, 10, 11].map((g) => (
                <option key={g} value={g}>
                  {t("gradeN", { n: g })}
                </option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("timeLimit")}
            <Input
              type="number"
              min={1}
              max={240}
              value={meta.timeLimitMin ?? ""}
              placeholder={t("unlimited")}
              onChange={(e) => setM({ timeLimitMin: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
          <label className="grid gap-1 text-sm font-extrabold">
            {t("maxAttempts")}
            <Input
              type="number"
              min={1}
              max={20}
              value={meta.maxAttempts ?? ""}
              placeholder={t("unlimited")}
              onChange={(e) => setM({ maxAttempts: e.target.value ? Number(e.target.value) : null })}
            />
          </label>
        </div>
      </Card>

      {/* 2 · content */}
      <Card className="grid gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="flex-1 text-lg font-bold">{t("step2")}</h2>
          <Button size="sm" variant="ghost" onClick={() => setPreview((p) => !p)} disabled={!compiled.ok}>
            {preview ? <Pencil aria-hidden /> : <Eye aria-hidden />}
            {preview ? t("backToEdit") : t("preview")}
          </Button>
        </div>

        {locked && (
          <p className="flex items-start gap-2 rounded-md bg-sun-100 px-3 py-2.5 text-sm font-semibold">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            {t("locked")}
          </p>
        )}

        {preview && compiled.ok ? (
          <TaskPreview
            type={meta.type}
            content={compiled.content as never}
            answerKey={compiled.answerKey as Record<string, Record<string, unknown>> | null}
          />
        ) : (
          <fieldset disabled={locked} className="grid gap-4 disabled:opacity-70">
            {PASSAGE_TYPES.includes(meta.type) && (
              <details open={!!draft.passage || meta.type === "TEXT_ANALYSIS"} className="rounded-md bg-cream p-3">
                <summary className="cursor-pointer text-sm font-extrabold">{t("passage")}</summary>
                <div className="mt-2 grid gap-2">
                  <Input
                    value={draft.source}
                    onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
                    placeholder={t("sourcePlaceholder")}
                    aria-label={t("source")}
                    className="min-h-10 py-2"
                  />
                  <Textarea
                    value={draft.passage}
                    onChange={(e) => setDraft((d) => ({ ...d, passage: e.target.value }))}
                    aria-label={t("passage")}
                    className="min-h-28"
                  />
                </div>
              </details>
            )}

            <ol className="grid gap-3">
              {draft.questions.map((q, i) => (
                <li
                  key={i}
                  className={cn(
                    "grid gap-3 rounded-lg border-2 bg-paper p-4",
                    result && !result.ok && result.question === i ? "border-coral-500" : "border-line",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <p className="flex-1 font-extrabold">{t("questionN", { n: i + 1 })}</p>
                    <IconButton label={t("moveUp")} onClick={() => move(i, -1)} disabled={i === 0} icon={ArrowUp} />
                    <IconButton
                      label={t("moveDown")}
                      onClick={() => move(i, 1)}
                      disabled={i === draft.questions.length - 1}
                      icon={ArrowDown}
                    />
                    <IconButton
                      label={t("removeQuestion")}
                      onClick={() => setDraft((d) => ({ ...d, questions: d.questions.filter((_, j) => j !== i) }))}
                      disabled={draft.questions.length <= 1}
                      icon={Trash2}
                    />
                  </div>
                  <QuestionEditor type={meta.type} q={q} index={i} onChange={(nq) => setQuestion(i, nq)} />
                </li>
              ))}
            </ol>
            {!manual && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start"
                onClick={() => setDraft((d) => ({ ...d, questions: [...d.questions, blankQuestion(meta.type)] }))}
              >
                <Plus aria-hidden />
                {t("addQuestion")}
              </Button>
            )}
          </fieldset>
        )}
      </Card>

      {/* 3 · checking */}
      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("step3")}</h2>
        {manual && (
          <fieldset disabled={locked} className="grid gap-2">
            <legend className="mb-1 text-sm font-extrabold">{t("criteria")}</legend>
            {draft.criteria.map((c, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_90px_auto] gap-2">
                <Input
                  value={c.title}
                  placeholder={t("criterionPlaceholder")}
                  aria-label={t("criterion", { n: i + 1 })}
                  className="min-h-10 py-2"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      criteria: d.criteria.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)),
                    }))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={c.max}
                  aria-label={t("criterionMax", { n: i + 1 })}
                  className="min-h-10 py-2"
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      criteria: d.criteria.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x)),
                    }))
                  }
                />
                <IconButton
                  label={t("removeCriterion")}
                  icon={Trash2}
                  disabled={draft.criteria.length <= 1}
                  onClick={() => setDraft((d) => ({ ...d, criteria: d.criteria.filter((_, j) => j !== i) }))}
                />
              </div>
            ))}
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-bold text-primary-edge"
                onClick={() => setDraft((d) => ({ ...d, criteria: [...d.criteria, { title: "", max: 1 }] }))}
              >
                <Plus className="size-4" aria-hidden />
                {t("addCriterion")}
              </button>
              <span
                className={cn("ml-auto text-sm font-extrabold", rubricSum === 10 ? "text-grass-700" : "text-coral-700")}
              >
                {t("rubricSum", { sum: rubricSum })}
              </span>
            </div>
          </fieldset>
        )}
        <label className="grid gap-1 text-sm font-extrabold">
          {t("explanation")}
          <Textarea
            value={meta.explanation}
            onChange={(e) => setM({ explanation: e.target.value })}
            className="min-h-20"
            maxLength={3000}
          />
          <span className="text-xs font-semibold text-muted">{t("explanationHint")}</span>
        </label>
      </Card>

      {/* save */}
      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/95 p-3 shadow-float backdrop-blur lg:bottom-4">
        <p
          role="status"
          className={cn("min-w-0 flex-1 text-sm font-bold", result && !result.ok ? "text-coral-700" : "text-grass-700")}
        >
          {errorText(result) ??
            (result?.ok
              ? t("savedOk")
              : !compiled.ok && compiled.error
                ? `${compiled.error.question != null ? `${t("questionN", { n: compiled.error.question + 1 })}: ` : ""}${t(`errors.${compiled.error.code}`)}`
                : "")}
        </p>
        <Button variant="ghost" onClick={() => save(false)} disabled={saving}>
          <Save aria-hidden />
          {t("saveDraft")}
        </Button>
        <Button variant="success" onClick={() => save(true)} disabled={saving}>
          <Send aria-hidden />
          {t("savePublish")}
        </Button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  icon: Icon,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  icon: typeof Plus;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="grid size-9 cursor-pointer place-items-center rounded-full text-ink-500 hover:bg-cream disabled:opacity-30"
    >
      <Icon className="size-4" aria-hidden />
    </button>
  );
}
