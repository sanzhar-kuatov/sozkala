import { describe, expect, it } from "vitest";
import { TaskType } from "@/generated/prisma/enums";
import { gradeQuestion, gradeTask, normalize } from "@/lib/grading/grade";
import { modelAnswer } from "@/lib/grading/model-answer";
import { countWords, isAnswered, sanitizeAnswers } from "@/lib/tasks/answers";
import { MANUAL_TYPES } from "@/lib/tasks/schemas";
import { DEMO_TASKS } from "@/prisma/seed/demo-tasks";

type Content = { questions: ({ id: string } & Record<string, unknown>)[] };
const auto = DEMO_TASKS.filter((t) => !MANUAL_TYPES.includes(t.type));

describe("gradeTask on every demo task", () => {
  it.each(auto.map((t) => [t.key, t] as const))("%s: model answers score 10, blank scores 0", (_, t) => {
    const content = t.content as Content;
    const key = t.answerKey as Record<string, Record<string, unknown>>;
    const perfect = Object.fromEntries(content.questions.map((q) => [q.id, modelAnswer(t.type, key[q.id])]));
    expect(gradeTask(t.type, content, key, perfect).score).toBe(10);
    expect(gradeTask(t.type, content, key, {}).score).toBe(0);
  });
});

describe("partial credit and penalties", () => {
  const opts = (...ids: string[]) => ids.map((id) => ({ id, text: id }));

  it("multiple choice: wrong picks cancel right ones (no 'tick everything')", () => {
    const q = { id: "q", options: opts("a", "b", "c", "d") };
    const key = { correct: ["a", "c"] };
    expect(gradeQuestion(TaskType.MULTIPLE_CHOICE, q, key, { choices: ["a"] })).toBe(0.5);
    expect(gradeQuestion(TaskType.MULTIPLE_CHOICE, q, key, { choices: ["a", "b", "c", "d"] })).toBe(0);
    expect(gradeQuestion(TaskType.MULTIPLE_CHOICE, q, key, { choices: ["a", "c", "b"] })).toBe(0.5);
  });

  it("matching counts correct pairs", () => {
    const key = { pairs: { l1: "r1", l2: "r2", l3: "r3", l4: "r4" } };
    expect(
      gradeQuestion(TaskType.MATCHING, { id: "q" }, key, { pairs: { l1: "r1", l2: "r3", l3: "r2", l4: "r4" } }),
    ).toBe(0.5);
  });

  it("fill gaps ignores case, spaces and ё/е", () => {
    const key = { gaps: { g1: ["ещё"], g2: ["Пётр"] } };
    expect(gradeQuestion(TaskType.FILL_GAPS, { id: "q" }, key, { gaps: { g1: " ЕЩЕ ", g2: "петр" } })).toBe(1);
  });

  it("word order is all-or-nothing", () => {
    const key = { order: ["a", "b", "c"] };
    expect(gradeQuestion(TaskType.WORD_ORDER, { id: "q" }, key, { order: ["a", "b", "c"] })).toBe(1);
    expect(gradeQuestion(TaskType.WORD_ORDER, { id: "q" }, key, { order: ["a", "c", "b"] })).toBe(0);
  });

  it("error correction penalises changing correct words", () => {
    const q = { id: "q", tokens: ["Мы", "видили", "картины."] };
    const key = { fixes: { "1": ["видели"] } };
    expect(gradeQuestion(TaskType.ERROR_CORRECTION, q, key, { fixes: { "1": "видели" } })).toBe(1);
    expect(gradeQuestion(TaskType.ERROR_CORRECTION, q, key, { fixes: { "1": "видели", "0": "Вы" } })).toBe(0);
    expect(gradeQuestion(TaskType.ERROR_CORRECTION, q, key, { fixes: { "1": "видели", "0": "мы" } })).toBe(1); // unchanged word
  });

  it("punctuation penalises extra marks", () => {
    const q = { id: "q", tokens: ["a", "b", "c", "d"] };
    const key = { marks: { "0": ",", "2": "," } };
    expect(gradeQuestion(TaskType.PUNCTUATION, q, key, { marks: { "0": "," } })).toBe(0.5);
    expect(gradeQuestion(TaskType.PUNCTUATION, q, key, { marks: { "0": ",", "1": ",", "2": "," } })).toBe(0.5);
    expect(gradeQuestion(TaskType.PUNCTUATION, q, key, { marks: { "0": ":", "2": "," } })).toBe(0.5);
  });

  it("short text answers accept alternatives", () => {
    const key = { accepted: ["120", "сто двадцать"] };
    expect(gradeQuestion(TaskType.TEXT_ANALYSIS, { id: "q" }, key, { text: "Сто двадцать." })).toBe(1);
  });

  it("scores round to one decimal", () => {
    const content = { questions: [{ id: "a" }, { id: "b" }, { id: "c" }] };
    const key = { a: { correct: "x" }, b: { correct: "x" }, c: { correct: "x" } };
    expect(gradeTask(TaskType.SINGLE_CHOICE, content, key, { a: { choice: "x" }, b: { choice: "x" } }).score).toBe(6.7);
  });
});

describe("answers", () => {
  it("drops malformed answers and unknown questions", () => {
    const clean = sanitizeAnswers(TaskType.SINGLE_CHOICE, ["q1", "q2"], {
      q1: { choice: "a" },
      q2: { choice: 5 },
      q3: { choice: "b" },
    });
    expect(clean).toEqual({ q1: { choice: "a" } });
  });

  it("knows when a question is answered", () => {
    expect(isAnswered(TaskType.MULTIPLE_CHOICE, { choices: [] })).toBe(false);
    expect(isAnswered(TaskType.ESSAY, { text: "  " })).toBe(false);
    expect(isAnswered(TaskType.PUNCTUATION, { marks: { "0": "," } })).toBe(true);
  });

  it("counts words in Russian and Kazakh text", () => {
    expect(countWords("Мой любимый герой — Пётр Гринёв.")).toBe(5);
    expect(countWords("Бүгін күн ашық")).toBe(3);
  });

  it("normalize strips surrounding punctuation", () => {
    expect(normalize("  «Правила.» ")).toBe("правила");
  });
});
