/**
 * Task editor ⇄ stored task. Teachers type plain text; this module turns it
 * into Task.content / answerKey / criteria (lib/tasks/schemas.ts) and back.
 *
 *   Fill gaps        "пр[е]красный, пр[и/ы]..."      [answer/alternative]
 *   Error correction "Вчера мы {видили|видели} ..."   {wrong|correct/alternative}
 *   Punctuation      the correct sentence — offered marks are removed into the key
 *   Word order       the correct sentence — words are shuffled for the student
 *   Matching         pairs; the right column is shuffled
 *
 * Pure (no DB), shared by the editor (client preview) and the save action.
 */
import { TaskType } from "@/generated/prisma/enums";
import type { TaskTypeValue } from "./schemas";

export type OptionDraft = { text: string; correct: boolean };
export type QuestionDraft = {
  prompt: string;
  options?: OptionDraft[];
  shortAnswer?: boolean;
  accepted?: string;
  pairs?: { left: string; right: string }[];
  gapText?: string;
  bank?: string;
  sentence?: string;
  marks?: string[];
  minWords?: number;
  maxWords?: number;
  readText?: string;
  maxSeconds?: number;
};
export type CriterionDraft = { title: string; max: number };
export type TaskDraft = { passage: string; source: string; questions: QuestionDraft[]; criteria: CriterionDraft[] };

export type DraftError =
  | "noQuestions"
  | "emptyPrompt"
  | "fewOptions"
  | "noCorrect"
  | "noAccepted"
  | "fewPairs"
  | "noGaps"
  | "fewWords"
  | "noErrors"
  | "noMarks"
  | "rubricSum";

export class DraftInvalid extends Error {
  constructor(
    public readonly code: DraftError,
    public readonly question?: number,
  ) {
    super(code);
  }
}

export const PUNCTUATION_MARKS = [",", ".", "—", ":", ";", "!", "?", "–"] as const;
export const DEFAULT_MARKS = [",", "—", ":"];

/* ---------------------------------------------------------------- helpers */

const clean = (s: string | undefined) => (s ?? "").trim();
const words = (s: string) => clean(s).split(/\s+/).filter(Boolean);
const alternatives = (s: string) =>
  s
    .split(/[/\n]/)
    .map((x) => x.trim())
    .filter(Boolean);

/** Small stable hash → deterministic shuffles (re-saving does not reorder everything). */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** Deterministic shuffle that never returns the original order (when length > 1). */
function shuffle<T>(items: T[], seed: string, keyOf: (t: T) => string): T[] {
  const out = [...items].sort((a, b) => hash(seed + keyOf(a)) - hash(seed + keyOf(b)));
  if (items.length > 1 && out.every((x, i) => x === items[i])) out.push(out.shift()!);
  return out;
}

const isManual = (type: TaskTypeValue) => type === "ESSAY" || type === "CREATIVE" || type === "AUDIO";

/* ------------------------------------------------------------ draft → task */

export function fromDraft(type: TaskTypeValue, draft: TaskDraft) {
  if (draft.questions.length === 0) throw new DraftInvalid("noQuestions");
  const questions: Record<string, unknown>[] = [];
  const answerKey: Record<string, unknown> = {};

  draft.questions.forEach((q, qi) => {
    const id = `q${qi + 1}`;
    const prompt = clean(q.prompt);
    if (!prompt) throw new DraftInvalid("emptyPrompt", qi);
    const fail = (code: DraftError) => {
      throw new DraftInvalid(code, qi);
    };

    switch (type) {
      case TaskType.SINGLE_CHOICE:
      case TaskType.CHARACTER_ID:
      case TaskType.MULTIPLE_CHOICE:
      case TaskType.TEXT_ANALYSIS: {
        if (type === TaskType.TEXT_ANALYSIS && q.shortAnswer) {
          const accepted = alternatives(q.accepted ?? "");
          if (!accepted.length) fail("noAccepted");
          questions.push({ id, prompt });
          answerKey[id] = { accepted };
          break;
        }
        const opts = (q.options ?? []).filter((o) => clean(o.text));
        if (opts.length < 2) fail("fewOptions");
        const options = opts.map((o, i) => ({ id: `o${i + 1}`, text: clean(o.text) }));
        const correct = opts.flatMap((o, i) => (o.correct ? [`o${i + 1}`] : []));
        if (!correct.length) fail("noCorrect");
        questions.push({ id, prompt, options });
        answerKey[id] = type === TaskType.MULTIPLE_CHOICE ? { correct } : { correct: correct[0] };
        break;
      }

      case TaskType.MATCHING: {
        const pairs = (q.pairs ?? []).filter((p) => clean(p.left) && clean(p.right));
        if (pairs.length < 2) fail("fewPairs");
        const left = pairs.map((p, i) => ({ id: `l${i + 1}`, text: clean(p.left) }));
        const rightInOrder = pairs.map((p, i) => ({ id: `r${i + 1}`, text: clean(p.right) }));
        const right = shuffle(rightInOrder, prompt, (r) => r.text);
        questions.push({ id, prompt, left, right });
        answerKey[id] = { pairs: Object.fromEntries(left.map((l, i) => [l.id, rightInOrder[i].id])) };
        break;
      }

      case TaskType.FILL_GAPS: {
        const gaps: Record<string, string[]> = {};
        let n = 0;
        const text = clean(q.gapText).replace(/\[([^\]]+)\]/g, (_, inner: string) => {
          const gid = `g${++n}`;
          gaps[gid] = alternatives(inner);
          return `[[${gid}]]`;
        });
        if (n === 0 || Object.values(gaps).some((a) => !a.length)) fail("noGaps");
        const bank = (q.bank ?? "")
          .split(",")
          .map((b) => b.trim())
          .filter(Boolean);
        questions.push({ id, prompt, text, ...(bank.length ? { bank } : {}) });
        answerKey[id] = { gaps };
        break;
      }

      case TaskType.WORD_ORDER: {
        const ws = words(q.sentence ?? "");
        if (ws.length < 2) fail("fewWords");
        const inOrder = ws.map((w, i) => ({ id: `t${i + 1}`, text: w }));
        questions.push({ id, prompt, tokens: shuffle(inOrder, prompt, (t) => t.id + t.text) });
        answerKey[id] = { order: inOrder.map((t) => t.id) };
        break;
      }

      case TaskType.ERROR_CORRECTION: {
        const tokens: string[] = [];
        const fixes: Record<string, string[]> = {};
        for (const raw of words(q.sentence ?? "")) {
          const m = raw.match(/^(.*)\{([^|}]+)\|([^}]+)\}(.*)$/);
          if (m) {
            const [, pre, wrong, right, post] = m;
            const accepted = alternatives(right).flatMap((a) => [pre + a + post, ...(post ? [pre + a] : [])]);
            fixes[String(tokens.length)] = [...new Set(accepted)];
            tokens.push(pre + wrong + post);
          } else tokens.push(raw);
        }
        if (tokens.length < 2) fail("fewWords");
        if (!Object.keys(fixes).length) fail("noErrors");
        questions.push({ id, prompt, tokens });
        answerKey[id] = { fixes };
        break;
      }

      case TaskType.PUNCTUATION: {
        const offered = (q.marks?.length ? q.marks : DEFAULT_MARKS).filter((m) =>
          (PUNCTUATION_MARKS as readonly string[]).includes(m),
        );
        const tokens: string[] = [];
        const marks: Record<string, string> = {};
        const parts = words(q.sentence ?? "");
        parts.forEach((part, i) => {
          const last = i === parts.length - 1;
          if (offered.includes(part) && tokens.length > 0) {
            marks[String(tokens.length - 1)] = part; // a free-standing dash belongs to the gap before it
            return;
          }
          const mark = !last ? offered.find((m) => part.length > m.length && part.endsWith(m)) : undefined;
          if (mark) {
            marks[String(tokens.length)] = mark;
            tokens.push(part.slice(0, -mark.length));
          } else tokens.push(part);
        });
        if (tokens.length < 2) fail("fewWords");
        if (!Object.keys(marks).length) fail("noMarks");
        questions.push({ id, prompt, tokens, marks: offered });
        answerKey[id] = { marks };
        break;
      }

      case TaskType.ESSAY:
      case TaskType.CREATIVE:
        questions.push({
          id,
          prompt,
          ...(q.minWords ? { minWords: q.minWords } : {}),
          ...(type === TaskType.ESSAY && q.maxWords ? { maxWords: q.maxWords } : {}),
        });
        break;

      case TaskType.AUDIO:
        questions.push({
          id,
          prompt,
          ...(clean(q.readText) ? { readText: clean(q.readText) } : {}),
          maxSeconds: q.maxSeconds ?? 180,
        });
        break;
    }
  });

  const content = {
    ...(clean(draft.passage) ? { passage: clean(draft.passage) } : {}),
    ...(clean(draft.source) ? { source: clean(draft.source) } : {}),
    questions,
  };

  if (isManual(type)) {
    const criteria = draft.criteria
      .filter((c) => clean(c.title))
      .map((c, i) => ({ id: `c${i + 1}`, title: clean(c.title), max: Math.round(c.max) }));
    if (criteria.reduce((s, c) => s + c.max, 0) !== 10) throw new DraftInvalid("rubricSum");
    return { content, answerKey: null, criteria };
  }
  return { content, answerKey, criteria: null };
}

/* ------------------------------------------------------------ task → draft */

type Opt = { id: string; text: string };

export function toDraft(
  type: TaskTypeValue,
  content: { passage?: string; source?: string; questions: Record<string, unknown>[] },
  answerKey: Record<string, Record<string, unknown>> | null,
  criteria: { title: string; max: number }[] | null,
): TaskDraft {
  const questions: QuestionDraft[] = content.questions.map((q) => {
    const key = answerKey?.[q.id as string] ?? {};
    const prompt = String(q.prompt ?? "");
    switch (type) {
      case TaskType.SINGLE_CHOICE:
      case TaskType.CHARACTER_ID:
      case TaskType.MULTIPLE_CHOICE:
      case TaskType.TEXT_ANALYSIS: {
        if (type === TaskType.TEXT_ANALYSIS && "accepted" in key) {
          return {
            prompt,
            shortAnswer: true,
            accepted: (key.accepted as string[]).join(" / "),
            options: blankOptions(),
          };
        }
        const correct = new Set(Array.isArray(key.correct) ? (key.correct as string[]) : [key.correct as string]);
        return { prompt, options: (q.options as Opt[]).map((o) => ({ text: o.text, correct: correct.has(o.id) })) };
      }
      case TaskType.MATCHING: {
        const pairs = key.pairs as Record<string, string>;
        const right = q.right as Opt[];
        return {
          prompt,
          pairs: (q.left as Opt[]).map((l) => ({
            left: l.text,
            right: right.find((r) => r.id === pairs[l.id])?.text ?? "",
          })),
        };
      }
      case TaskType.FILL_GAPS: {
        const gaps = key.gaps as Record<string, string[]>;
        return {
          prompt,
          gapText: String(q.text).replace(/\[\[([^\]]+)\]\]/g, (_, g: string) => `[${(gaps[g] ?? []).join("/")}]`),
          bank: ((q.bank as string[] | undefined) ?? []).join(", "),
        };
      }
      case TaskType.WORD_ORDER: {
        const tokens = q.tokens as Opt[];
        return {
          prompt,
          sentence: (key.order as string[]).map((id) => tokens.find((t) => t.id === id)?.text).join(" "),
        };
      }
      case TaskType.ERROR_CORRECTION: {
        const fixes = key.fixes as Record<string, string[]>;
        return {
          prompt,
          sentence: (q.tokens as string[]).map((w, i) => (fixes[i] ? `{${w}|${fixes[i][0]}}` : w)).join(" "),
        };
      }
      case TaskType.PUNCTUATION: {
        const marks = key.marks as Record<string, string>;
        return {
          prompt,
          marks: q.marks as string[],
          sentence: (q.tokens as string[])
            .map((w, i) => w + (marks[i] ? (marks[i] === "—" || marks[i] === "–" ? ` ${marks[i]}` : marks[i]) : ""))
            .join(" "),
        };
      }
      case TaskType.ESSAY:
      case TaskType.CREATIVE:
        return { prompt, minWords: q.minWords as number | undefined, maxWords: q.maxWords as number | undefined };
      case TaskType.AUDIO:
        return {
          prompt,
          readText: (q.readText as string | undefined) ?? "",
          maxSeconds: (q.maxSeconds as number) ?? 180,
        };
    }
  });
  return {
    passage: content.passage ?? "",
    source: content.source ?? "",
    questions,
    criteria: criteria?.map((c) => ({ title: c.title, max: c.max })) ?? defaultCriteria(),
  };
}

/* ---------------------------------------------------------------- blanks */

export const blankOptions = (): OptionDraft[] => [
  { text: "", correct: true },
  { text: "", correct: false },
  { text: "", correct: false },
];

export const defaultCriteria = (): CriterionDraft[] => [
  { title: "", max: 4 },
  { title: "", max: 3 },
  { title: "", max: 3 },
];

export function blankQuestion(type: TaskTypeValue): QuestionDraft {
  switch (type) {
    case TaskType.MATCHING:
      return {
        prompt: "",
        pairs: [
          { left: "", right: "" },
          { left: "", right: "" },
          { left: "", right: "" },
        ],
      };
    case TaskType.FILL_GAPS:
      return { prompt: "", gapText: "", bank: "" };
    case TaskType.WORD_ORDER:
    case TaskType.ERROR_CORRECTION:
      return { prompt: "", sentence: "" };
    case TaskType.PUNCTUATION:
      return { prompt: "", sentence: "", marks: [...DEFAULT_MARKS] };
    case TaskType.ESSAY:
    case TaskType.CREATIVE:
      return { prompt: "", minWords: 80 };
    case TaskType.AUDIO:
      return { prompt: "", readText: "", maxSeconds: 180 };
    default:
      return { prompt: "", options: blankOptions(), shortAnswer: false, accepted: "" };
  }
}
