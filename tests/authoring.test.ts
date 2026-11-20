import { describe, expect, it } from "vitest";
import { TaskType } from "@/generated/prisma/enums";
import { gradeTask } from "@/lib/grading/grade";
import { modelAnswer } from "@/lib/grading/model-answer";
import { DraftInvalid, fromDraft, toDraft, type TaskDraft } from "@/lib/tasks/authoring";
import { MANUAL_TYPES, parseTask } from "@/lib/tasks/schemas";
import { DEMO_TASKS } from "@/prisma/seed/demo-tasks";

type Content = { passage?: string; source?: string; questions: ({ id: string } & Record<string, unknown>)[] };
const draft = (questions: TaskDraft["questions"], criteria: TaskDraft["criteria"] = []): TaskDraft => ({
  passage: "",
  source: "",
  questions,
  criteria,
});

describe("editor round trip on every demo task", () => {
  it.each(DEMO_TASKS.map((t) => [t.key, t] as const))("%s: task → draft → task stays valid and gradeable", (_, t) => {
    const d = toDraft(t.type, t.content as Content, (t.answerKey ?? null) as never, (t.criteria ?? null) as never);
    const out = fromDraft(t.type, d);
    expect(() => parseTask({ type: t.type, ...out })).not.toThrow();
    if (!MANUAL_TYPES.includes(t.type)) {
      const content = out.content as Content;
      const key = out.answerKey as Record<string, Record<string, unknown>>;
      const perfect = Object.fromEntries(content.questions.map((q) => [q.id, modelAnswer(t.type, key[q.id])]));
      expect(gradeTask(t.type, content, key, perfect).score).toBe(10);
    }
    // and the draft is stable: converting again gives the same draft
    expect(toDraft(t.type, out.content as Content, out.answerKey as never, out.criteria as never)).toEqual(d);
  });
});

describe("teacher notation", () => {
  it("fill gaps: [answer/alternative]", () => {
    const out = fromDraft(
      TaskType.FILL_GAPS,
      draft([{ prompt: "?", gapText: "пр[е]красный и [ещё/еще] раз", bank: "е, и" }]),
    );
    expect(out.content.questions[0]).toMatchObject({ text: "пр[[g1]]красный и [[g2]] раз", bank: ["е", "и"] });
    expect(out.answerKey).toEqual({ q1: { gaps: { g1: ["е"], g2: ["ещё", "еще"] } } });
  });

  it("error correction: {wrong|right} keeps punctuation around the word", () => {
    const out = fromDraft(
      TaskType.ERROR_CORRECTION,
      draft([{ prompt: "?", sentence: "Мы стояли у {калитке|калитки}." }]),
    );
    expect(out.content.questions[0]).toMatchObject({ tokens: ["Мы", "стояли", "у", "калитке."] });
    expect(out.answerKey).toEqual({ q1: { fixes: { "3": ["калитки.", "калитки"] } } });
  });

  it("punctuation: marks are taken out of the correct sentence", () => {
    const out = fromDraft(
      TaskType.PUNCTUATION,
      draft([{ prompt: "?", sentence: "Москва — столица России, а Астана — столица Казахстана.", marks: [",", "—"] }]),
    );
    expect(out.content.questions[0]).toMatchObject({
      tokens: ["Москва", "столица", "России", "а", "Астана", "столица", "Казахстана."],
    });
    expect(out.answerKey).toEqual({ q1: { marks: { "0": "—", "2": ",", "4": "—" } } });
  });

  it("word order: tokens are shuffled, the key keeps the sentence", () => {
    const out = fromDraft(TaskType.WORD_ORDER, draft([{ prompt: "?", sentence: "Мы идём в школу" }]));
    const tokens = (out.content.questions[0] as { tokens: { id: string }[] }).tokens.map((t) => t.id);
    expect(tokens).not.toEqual(["t1", "t2", "t3", "t4"]);
    expect(out.answerKey).toEqual({ q1: { order: ["t1", "t2", "t3", "t4"] } });
  });

  it("matching: the right column is shuffled but pairs stay correct", () => {
    const pairs = [
      { left: "a", right: "1" },
      { left: "b", right: "2" },
      { left: "c", right: "3" },
    ];
    const out = fromDraft(TaskType.MATCHING, draft([{ prompt: "?", pairs }]));
    const q = out.content.questions[0] as { right: { text: string }[] };
    expect(q.right.map((r) => r.text)).not.toEqual(["1", "2", "3"]);
    expect(out.answerKey).toEqual({ q1: { pairs: { l1: "r1", l2: "r2", l3: "r3" } } });
  });
});

describe("helpful errors", () => {
  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof DraftInvalid ? `${e.code}@${e.question ?? "-"}` : String(e);
    }
    return "ok";
  };
  it.each([
    [
      TaskType.SINGLE_CHOICE,
      draft([
        {
          prompt: "?",
          options: [
            { text: "a", correct: false },
            { text: "b", correct: false },
          ],
        },
      ]),
      "noCorrect@0",
    ],
    [TaskType.SINGLE_CHOICE, draft([{ prompt: "", options: [] }]), "emptyPrompt@0"],
    [TaskType.FILL_GAPS, draft([{ prompt: "?", gapText: "без пропусков" }]), "noGaps@0"],
    [TaskType.ERROR_CORRECTION, draft([{ prompt: "?", sentence: "всё верно тут" }]), "noErrors@0"],
    [TaskType.PUNCTUATION, draft([{ prompt: "?", sentence: "без знаков тут" }]), "noMarks@0"],
    [TaskType.ESSAY, draft([{ prompt: "Пиши" }], [{ title: "A", max: 5 }]), "rubricSum@-"],
  ] as const)("%s → %s", (type, d, expected) => {
    expect(code(() => fromDraft(type, d))).toBe(expected);
  });
});
