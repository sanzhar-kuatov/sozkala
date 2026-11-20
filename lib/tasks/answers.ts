/**
 * Shapes of a student's answers (Attempt.answers = { [questionId]: Answer }) per
 * task type, plus helpers shared by the player, the server actions and the grader.
 * Counterpart of lib/tasks/schemas.ts (task content + answer key).
 */
import { z } from "zod";
import { TaskType } from "@/generated/prisma/enums";
import type { TaskTypeValue } from "./schemas";

const id = z.string().max(40);
const short = z.string().max(200);
const indexKey = z.string().regex(/^\d+$/);

export const answerSchemas = {
  [TaskType.SINGLE_CHOICE]: z.object({ choice: id }),
  [TaskType.CHARACTER_ID]: z.object({ choice: id }),
  [TaskType.MULTIPLE_CHOICE]: z.object({ choices: z.array(id).max(20) }),
  [TaskType.MATCHING]: z.object({ pairs: z.record(id, id) }),
  [TaskType.FILL_GAPS]: z.object({ gaps: z.record(id, short) }),
  [TaskType.WORD_ORDER]: z.object({ order: z.array(id).max(50) }),
  /** word index → the student's corrected word */
  [TaskType.ERROR_CORRECTION]: z.object({ fixes: z.record(indexKey, short) }),
  /** gap index (after word i) → mark */
  [TaskType.PUNCTUATION]: z.object({ marks: z.record(indexKey, z.string().max(2)) }),
  [TaskType.TEXT_ANALYSIS]: z.object({ choice: id.optional(), text: short.optional() }),
  [TaskType.ESSAY]: z.object({ text: z.string().max(20_000) }),
  [TaskType.CREATIVE]: z.object({ text: z.string().max(20_000) }),
  /** uploaded recording (served by /api/files/…) */
  [TaskType.AUDIO]: z.object({ file: z.string().max(200), durationSec: z.number().min(0).max(900).optional() }),
} as const satisfies Record<TaskTypeValue, z.ZodType>;

export type AnswerOf<T extends TaskTypeValue> = z.infer<(typeof answerSchemas)[T]>;
export type Answers = Record<string, unknown>;

/** Answers as a Prisma JSON value (they are plain JSON objects by construction). */
export const answersJson = (a: Answers) => a as Record<string, string | number | boolean | object | null>;

/**
 * Keeps only well-formed answers for questions that exist; anything malformed is
 * dropped (treated as unanswered) instead of failing the whole save.
 */
export function sanitizeAnswers(type: TaskTypeValue, questionIds: string[], raw: unknown): Answers {
  if (!raw || typeof raw !== "object") return {};
  const out: Answers = {};
  for (const qid of questionIds) {
    const parsed = answerSchemas[type].safeParse((raw as Record<string, unknown>)[qid]);
    if (parsed.success) out[qid] = parsed.data;
  }
  return out;
}

/** Whether a question has a usable answer (for "3 of 6 answered" and the submit warning). */
export function isAnswered(type: TaskTypeValue, answer: unknown): boolean {
  if (!answer || typeof answer !== "object") return false;
  const a = answer as Record<string, unknown>;
  switch (type) {
    case TaskType.SINGLE_CHOICE:
    case TaskType.CHARACTER_ID:
      return typeof a.choice === "string" && a.choice !== "";
    case TaskType.MULTIPLE_CHOICE:
      return Array.isArray(a.choices) && a.choices.length > 0;
    case TaskType.MATCHING:
    case TaskType.FILL_GAPS:
    case TaskType.ERROR_CORRECTION:
    case TaskType.PUNCTUATION: {
      const map = (a.pairs ?? a.gaps ?? a.fixes ?? a.marks) as Record<string, string> | undefined;
      return !!map && Object.values(map).some((v) => String(v).trim() !== "");
    }
    case TaskType.WORD_ORDER:
      return Array.isArray(a.order) && a.order.length > 0;
    case TaskType.TEXT_ANALYSIS:
      return (typeof a.choice === "string" && a.choice !== "") || (typeof a.text === "string" && a.text.trim() !== "");
    case TaskType.ESSAY:
    case TaskType.CREATIVE:
      return typeof a.text === "string" && a.text.trim() !== "";
    case TaskType.AUDIO:
      return typeof a.file === "string" && a.file !== "";
  }
}

/** Word count used by the essay counter and min/max checks. */
export const countWords = (text: string) => (text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length;
