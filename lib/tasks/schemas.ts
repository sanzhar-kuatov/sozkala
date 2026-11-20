/**
 * Shapes of Task.content, Task.answerKey and Task.criteria for every task type (spec §5).
 *
 * A task holds one or more questions of the same type, plus an optional shared
 * passage (text analysis, character identification). Every question has a stable
 * `id`; the answer key is a map from question id to that question's key.
 *
 *   content   = { passage?, source?, questions: Question[] }
 *   answerKey = { [questionId]: Key }          (auto-graded types only)
 *   criteria  = [{ id, title, max }]  Σmax = 10 (manual types only)
 *
 * The answer key never leaves the server — the task player receives `content` only.
 */
import { z } from "zod";
import { GradingMode, TaskType } from "@/generated/prisma/enums";

const id = z.string().min(1).max(40);
const text = z.string().trim().min(1);
const option = z.object({ id, text });
const options = z.array(option).min(2).max(10);
const accepted = z.array(text).min(1); // acceptable answers, compared case-insensitively

const base = { id, prompt: text };

/** Question content + answer key schema for each type. `key: null` = graded manually. */
export const taskTypeSchemas = {
  [TaskType.SINGLE_CHOICE]: {
    question: z.object({ ...base, options }),
    key: z.object({ correct: id }),
  },
  [TaskType.MULTIPLE_CHOICE]: {
    question: z.object({ ...base, options }),
    key: z.object({ correct: z.array(id).min(1) }),
  },
  [TaskType.MATCHING]: {
    question: z.object({ ...base, left: options, right: options }),
    /** left id → right id */
    key: z.object({ pairs: z.record(id, id) }),
  },
  [TaskType.FILL_GAPS]: {
    /** `text` marks gaps as [[gapId]], e.g. "деревя[[g1]]ый". Optional word bank. */
    question: z.object({ ...base, text, bank: z.array(text).optional() }),
    key: z.object({ gaps: z.record(id, accepted) }),
  },
  [TaskType.WORD_ORDER]: {
    /** tokens are stored in the order shown (shuffled by the author or the player). */
    question: z.object({ ...base, tokens: options }),
    key: z.object({ order: z.array(id).min(2) }),
  },
  [TaskType.ERROR_CORRECTION]: {
    /** The sentence split into words; the student taps a wrong word and fixes it. */
    question: z.object({ ...base, tokens: z.array(text).min(2) }),
    /** word index → accepted corrections. Other words must stay unchanged. */
    key: z.object({ fixes: z.record(z.string().regex(/^\d+$/), accepted) }),
  },
  [TaskType.PUNCTUATION]: {
    /** Gap i is the space after token i. `marks` = signs offered to the student. */
    question: z.object({
      ...base,
      tokens: z.array(text).min(2),
      marks: z.array(z.enum([",", ".", "—", ":", ";", "!", "?", "–"])).min(1),
    }),
    /** gap index → required sign. Gaps not listed must stay empty. */
    key: z.object({ marks: z.record(z.string().regex(/^\d+$/), z.string().min(1)) }),
  },
  [TaskType.TEXT_ANALYSIS]: {
    /** Choice question (options) or short answer (no options) about the passage. */
    question: z.object({ ...base, options: options.optional() }),
    key: z.union([z.object({ correct: id }), z.object({ accepted })]),
  },
  [TaskType.CHARACTER_ID]: {
    question: z.object({ ...base, options }),
    key: z.object({ correct: id }),
  },
  [TaskType.ESSAY]: {
    question: z.object({
      ...base,
      minWords: z.int().positive().optional(),
      maxWords: z.int().positive().optional(),
    }),
    key: null,
  },
  [TaskType.CREATIVE]: {
    question: z.object({ ...base, minWords: z.int().positive().optional() }),
    key: null,
  },
  [TaskType.AUDIO]: {
    /** `readText`: a passage to read aloud (optional). Recording limit defaults to 3 minutes. */
    question: z.object({
      ...base,
      readText: text.optional(),
      maxSeconds: z.int().min(10).max(600).default(180),
    }),
    key: null,
  },
} as const;

export type TaskTypeValue = keyof typeof taskTypeSchemas;

/** Manual types are graded by the teacher; everything else is auto-graded. */
export const MANUAL_TYPES: readonly TaskTypeValue[] = [TaskType.ESSAY, TaskType.CREATIVE, TaskType.AUDIO];

export function gradingFor(type: TaskTypeValue): GradingMode {
  return MANUAL_TYPES.includes(type) ? GradingMode.MANUAL : GradingMode.AUTO;
}

export const criteriaSchema = z
  .array(z.object({ id, title: text, max: z.int().min(1).max(10) }))
  .min(1)
  .refine((c) => c.reduce((s, x) => s + x.max, 0) === 10, "rubric maximums must add up to 10")
  .refine((c) => new Set(c.map((x) => x.id)).size === c.length, "criterion ids must be unique");

export type Criteria = z.infer<typeof criteriaSchema>;

export function contentSchema(type: TaskTypeValue) {
  return z
    .object({
      passage: text.optional(),
      source: text.optional(), // author and work, e.g. «А. С. Пушкин, „Капитанская дочка“»
      questions: z.array(taskTypeSchemas[type].question).min(1).max(50),
    })
    .refine((c) => new Set(c.questions.map((q) => q.id)).size === c.questions.length, "question ids must be unique");
}

export type TaskPayload = {
  type: TaskTypeValue;
  content: unknown;
  answerKey?: unknown;
  criteria?: unknown;
};

/**
 * Validates a whole task definition: content shape, an answer key for every
 * question of an auto-graded type (with ids that exist), or a rubric for a manual type.
 * Returns the parsed values or throws a ZodError / Error with a readable message.
 */
export function parseTask({ type, content, answerKey, criteria }: TaskPayload) {
  const parsedContent = contentSchema(type).parse(content);
  const keySchema = taskTypeSchemas[type].key;

  if (keySchema === null) {
    return { content: parsedContent, answerKey: null, criteria: criteriaSchema.parse(criteria) };
  }

  const parsedKey = z.record(id, keySchema).parse(answerKey);
  for (const q of parsedContent.questions) {
    const k = parsedKey[q.id];
    if (!k) throw new Error(`answer key missing for question "${q.id}"`);
    checkKeyRefs(type, q as Record<string, unknown>, k as Record<string, unknown>);
  }
  return { content: parsedContent, answerKey: parsedKey, criteria: null };
}

/** Make sure the key only references option/token ids that exist in the question. */
function checkKeyRefs(type: TaskTypeValue, q: Record<string, unknown>, k: Record<string, unknown>) {
  const ids = (list: unknown) => new Set(((list as { id: string }[] | undefined) ?? []).map((o) => o.id));
  const fail = (msg: string) => {
    throw new Error(`question "${q.id as string}": ${msg}`);
  };

  switch (type) {
    case TaskType.SINGLE_CHOICE:
    case TaskType.CHARACTER_ID:
      if (!ids(q.options).has(k.correct as string)) fail("correct option does not exist");
      break;
    case TaskType.TEXT_ANALYSIS:
      if ("correct" in k && !ids(q.options).has(k.correct as string)) fail("correct option does not exist");
      if ("accepted" in k && q.options) fail("choice question needs `correct`, not `accepted`");
      break;
    case TaskType.MULTIPLE_CHOICE: {
      const opts = ids(q.options);
      if (!(k.correct as string[]).every((c) => opts.has(c))) fail("correct option does not exist");
      break;
    }
    case TaskType.MATCHING: {
      const left = ids(q.left);
      const right = ids(q.right);
      const pairs = k.pairs as Record<string, string>;
      if (Object.keys(pairs).length !== left.size) fail("every left item needs a pair");
      for (const [l, r] of Object.entries(pairs)) if (!left.has(l) || !right.has(r)) fail(`bad pair ${l}→${r}`);
      break;
    }
    case TaskType.FILL_GAPS: {
      const inText = [...(q.text as string).matchAll(/\[\[([^\]]+)\]\]/g)].map((m) => m[1]);
      const keyed = Object.keys(k.gaps as object);
      if (inText.length === 0) fail("text has no [[gap]] markers");
      if (inText.sort().join() !== keyed.sort().join()) fail("gaps in text and key differ");
      break;
    }
    case TaskType.WORD_ORDER: {
      const tokens = ids(q.tokens);
      const order = k.order as string[];
      if (order.length !== tokens.size || !order.every((t) => tokens.has(t))) fail("order must use every token once");
      break;
    }
    case TaskType.ERROR_CORRECTION: {
      const n = (q.tokens as string[]).length;
      if (Object.keys(k.fixes as object).some((i) => Number(i) >= n)) fail("fix index out of range");
      break;
    }
    case TaskType.PUNCTUATION: {
      const n = (q.tokens as string[]).length;
      const allowed = new Set(q.marks as string[]);
      for (const [i, m] of Object.entries(k.marks as Record<string, string>)) {
        if (Number(i) >= n) fail("gap index out of range");
        if (!allowed.has(m)) fail(`mark "${m}" is not offered to the student`);
      }
      break;
    }
  }
}
