/**
 * Automatic grading of closed task types (spec §5 "closed tasks are checked
 * automatically"). Pure functions — no database — so they are easy to test.
 *
 * Each question earns 0…1 (partial credit where it is fair); the task score is
 * the average × 10, rounded to one decimal (spec §4: 10-point scale).
 */
import { TaskType } from "@/generated/prisma/enums";
import type { Answers } from "@/lib/tasks/answers";
import type { TaskTypeValue } from "@/lib/tasks/schemas";

export type QuestionResult = { questionId: string; earned: number; max: 1; correct: boolean };
export type GradeResult = { score: number; results: QuestionResult[] };

/** Text comparison: case, spaces, ё/е and surrounding punctuation do not matter. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,!?;:«»"'()\-–—]+|[.,!?;:«»"'()\-–—]+$/g, "")
    .trim();
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const matches = (value: unknown, accepted: string[]) =>
  typeof value === "string" && accepted.some((a) => normalize(a) === normalize(value));

type Q = Record<string, unknown> & { id: string };
type K = Record<string, unknown>;

/** Score one question (0…1). */
export function gradeQuestion(type: TaskTypeValue, question: Q, key: K, answer: unknown): number {
  const a = (answer ?? {}) as Record<string, unknown>;
  switch (type) {
    case TaskType.SINGLE_CHOICE:
    case TaskType.CHARACTER_ID:
      return a.choice === key.correct ? 1 : 0;

    case TaskType.MULTIPLE_CHOICE: {
      // right picks minus wrong picks, relative to the number of right options — guessing "all" does not pay
      const correct = new Set(key.correct as string[]);
      const picked = new Set(Array.isArray(a.choices) ? (a.choices as string[]) : []);
      let right = 0;
      let wrong = 0;
      for (const p of picked) {
        if (correct.has(p)) right++;
        else wrong++;
      }
      return clamp01((right - wrong) / correct.size);
    }

    case TaskType.MATCHING: {
      const pairs = key.pairs as Record<string, string>;
      const given = (a.pairs ?? {}) as Record<string, string>;
      const total = Object.keys(pairs).length;
      return Object.entries(pairs).filter(([l, r]) => given[l] === r).length / total;
    }

    case TaskType.FILL_GAPS: {
      const gaps = key.gaps as Record<string, string[]>;
      const given = (a.gaps ?? {}) as Record<string, string>;
      const ids = Object.keys(gaps);
      return ids.filter((g) => matches(given[g], gaps[g])).length / ids.length;
    }

    case TaskType.WORD_ORDER: {
      const order = key.order as string[];
      const given = Array.isArray(a.order) ? (a.order as string[]) : [];
      return given.length === order.length && given.every((t, i) => t === order[i]) ? 1 : 0;
    }

    case TaskType.ERROR_CORRECTION: {
      // fixed errors minus words that were "corrected" although they were right
      const fixes = key.fixes as Record<string, string[]>;
      const tokens = question.tokens as string[];
      const given = (a.fixes ?? {}) as Record<string, string>;
      let right = 0;
      let wrongEdits = 0;
      for (const [i, value] of Object.entries(given)) {
        if (fixes[i]) {
          if (matches(value, fixes[i])) right++;
        } else if (normalize(value) !== normalize(tokens[Number(i)] ?? "")) {
          wrongEdits++;
        }
      }
      return clamp01((right - wrongEdits) / Object.keys(fixes).length);
    }

    case TaskType.PUNCTUATION: {
      // correct marks minus marks placed where none belongs
      const marks = key.marks as Record<string, string>;
      const given = Object.fromEntries(
        Object.entries((a.marks ?? {}) as Record<string, string>).filter(([, m]) => m && m.trim() !== ""),
      );
      const required = Object.keys(marks);
      const right = required.filter((i) => given[i] === marks[i]).length;
      const extra = Object.keys(given).filter((i) => !(i in marks)).length;
      return clamp01((right - extra) / required.length);
    }

    case TaskType.TEXT_ANALYSIS:
      if ("correct" in key) return a.choice === key.correct ? 1 : 0;
      return matches(a.text, key.accepted as string[]) ? 1 : 0;

    default:
      return 0; // manual types are graded by the teacher
  }
}

/** Grade a whole auto-graded task. */
export function gradeTask(
  type: TaskTypeValue,
  content: { questions: Q[] },
  answerKey: Record<string, K>,
  answers: Answers,
): GradeResult {
  const results: QuestionResult[] = content.questions.map((q) => {
    const earned = Math.round(gradeQuestion(type, q, answerKey[q.id] ?? {}, answers[q.id]) * 100) / 100;
    return { questionId: q.id, earned, max: 1, correct: earned === 1 };
  });
  const avg = results.reduce((s, r) => s + r.earned, 0) / Math.max(1, results.length);
  return { score: Math.round(avg * 100) / 10, results };
}
