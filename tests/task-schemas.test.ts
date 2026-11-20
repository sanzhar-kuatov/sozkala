import { describe, expect, it } from "vitest";
import { TaskType } from "@/generated/prisma/enums";
import { gradingFor, parseTask, taskTypeSchemas } from "@/lib/tasks/schemas";
import { DEMO_TASKS } from "@/prisma/seed/demo-tasks";

describe("task schemas", () => {
  it("cover every task type", () => {
    expect(Object.keys(taskTypeSchemas).sort()).toEqual(Object.values(TaskType).sort());
  });

  it("demo tasks cover all 12 types", () => {
    expect(new Set(DEMO_TASKS.map((t) => t.type)).size).toBe(12);
  });

  it.each(DEMO_TASKS.map((t) => [t.key, t] as const))("demo task %s is valid", (_, t) => {
    expect(() => parseTask(t)).not.toThrow();
  });

  it("essay, creative and audio are graded manually", () => {
    expect(gradingFor(TaskType.ESSAY)).toBe("MANUAL");
    expect(gradingFor(TaskType.AUDIO)).toBe("MANUAL");
    expect(gradingFor(TaskType.MATCHING)).toBe("AUTO");
  });
});

const single = {
  type: TaskType.SINGLE_CHOICE,
  content: {
    questions: [
      {
        id: "q1",
        prompt: "?",
        options: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
      },
    ],
  },
};

describe("parseTask rejects broken definitions", () => {
  it("missing answer key for a question", () => {
    expect(() => parseTask({ ...single, answerKey: {} })).toThrow(/missing/);
  });

  it("answer key pointing at a non-existent option", () => {
    expect(() => parseTask({ ...single, answerKey: { q1: { correct: "z" } } })).toThrow(/does not exist/);
  });

  it("duplicate question ids", () => {
    const q = single.content.questions[0];
    expect(() =>
      parseTask({ ...single, content: { questions: [q, q] }, answerKey: { q1: { correct: "a" } } }),
    ).toThrow();
  });

  it("fill-gaps key that does not match the [[gap]] markers", () => {
    expect(() =>
      parseTask({
        type: TaskType.FILL_GAPS,
        content: { questions: [{ id: "q1", prompt: "?", text: "пр[[g1]]красный" }] },
        answerKey: { q1: { gaps: { g2: ["е"] } } },
      }),
    ).toThrow(/differ/);
  });

  it("punctuation mark not offered to the student", () => {
    expect(() =>
      parseTask({
        type: TaskType.PUNCTUATION,
        content: { questions: [{ id: "q1", prompt: "?", tokens: ["a", "b"], marks: [","] }] },
        answerKey: { q1: { marks: { "0": ":" } } },
      }),
    ).toThrow(/not offered/);
  });

  it("manual task whose rubric does not add up to 10", () => {
    expect(() =>
      parseTask({
        type: TaskType.ESSAY,
        content: { questions: [{ id: "q1", prompt: "Напишите эссе." }] },
        criteria: [{ id: "c", title: "Содержание", max: 5 }],
      }),
    ).toThrow();
  });
});
