/**
 * Builds the fully correct answer for a question from its answer key — used to
 * show "correct answer" on the result screen, in tests and by the demo seed.
 */
import { TaskType } from "@/generated/prisma/enums";
import type { TaskTypeValue } from "@/lib/tasks/schemas";

type K = Record<string, unknown>;

export function modelAnswer(type: TaskTypeValue, key: K): unknown {
  switch (type) {
    case TaskType.SINGLE_CHOICE:
    case TaskType.CHARACTER_ID:
      return { choice: key.correct };
    case TaskType.MULTIPLE_CHOICE:
      return { choices: key.correct };
    case TaskType.MATCHING:
      return { pairs: key.pairs };
    case TaskType.FILL_GAPS:
      return {
        gaps: Object.fromEntries(Object.entries(key.gaps as Record<string, string[]>).map(([g, v]) => [g, v[0]])),
      };
    case TaskType.WORD_ORDER:
      return { order: key.order };
    case TaskType.ERROR_CORRECTION:
      return {
        fixes: Object.fromEntries(Object.entries(key.fixes as Record<string, string[]>).map(([i, v]) => [i, v[0]])),
      };
    case TaskType.PUNCTUATION:
      return { marks: key.marks };
    case TaskType.TEXT_ANALYSIS:
      return "correct" in key ? { choice: key.correct } : { text: (key.accepted as string[])[0] };
    default:
      return null;
  }
}
