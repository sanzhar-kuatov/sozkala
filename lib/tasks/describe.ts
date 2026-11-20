/**
 * Renders an answer (the student's or the model one) as readable text for the
 * result screen and teacher views, e.g. "бить баклуши → бездельничать".
 * Returns null when nothing was answered.
 */
import { TaskType } from "@/generated/prisma/enums";
import type { TaskTypeValue } from "./schemas";

type Opt = { id: string; text: string };
type Q = Record<string, unknown>;
type A = Record<string, unknown> | null | undefined;

const optText = (list: unknown, id: unknown) => (list as Opt[] | undefined)?.find((o) => o.id === id)?.text ?? "";

export function describeAnswer(type: TaskTypeValue, q: Q, a: A): string | null {
  if (!a) return null;
  switch (type) {
    case TaskType.SINGLE_CHOICE:
    case TaskType.CHARACTER_ID:
      return a.choice ? optText(q.options, a.choice) : null;

    case TaskType.MULTIPLE_CHOICE: {
      const picked = (a.choices as string[] | undefined) ?? [];
      return picked.length ? picked.map((id) => optText(q.options, id)).join(", ") : null;
    }

    case TaskType.MATCHING: {
      const pairs = (a.pairs as Record<string, string> | undefined) ?? {};
      const lines = (q.left as Opt[])
        .filter((l) => pairs[l.id])
        .map((l) => `${l.text} → ${optText(q.right, pairs[l.id])}`);
      return lines.length ? lines.join("; ") : null;
    }

    case TaskType.FILL_GAPS: {
      const gaps = (a.gaps as Record<string, string> | undefined) ?? {};
      if (!Object.values(gaps).some((v) => v?.trim())) return null;
      return String(q.text).replace(/\[\[([^\]]+)\]\]/g, (_, g: string) => `[${gaps[g]?.trim() || "…"}]`);
    }

    case TaskType.WORD_ORDER: {
      const order = (a.order as string[] | undefined) ?? [];
      return order.length ? order.map((id) => optText(q.tokens, id)).join(" ") : null;
    }

    case TaskType.ERROR_CORRECTION: {
      const fixes = (a.fixes as Record<string, string> | undefined) ?? {};
      if (Object.keys(fixes).length === 0) return null;
      return (q.tokens as string[]).map((w, i) => (fixes[i] != null ? `[${fixes[i]}]` : w)).join(" ");
    }

    case TaskType.PUNCTUATION: {
      const marks = (a.marks as Record<string, string> | undefined) ?? {};
      if (Object.keys(marks).length === 0) return null;
      const tokens = q.tokens as string[];
      return tokens
        .map((w, i) => w + (marks[i] ? (marks[i] === "—" || marks[i] === "–" ? ` ${marks[i]}` : marks[i]) : ""))
        .join(" ");
    }

    case TaskType.TEXT_ANALYSIS:
      if (a.choice) return optText(q.options, a.choice);
      return typeof a.text === "string" && a.text.trim() ? a.text.trim() : null;

    case TaskType.ESSAY:
    case TaskType.CREATIVE:
      return typeof a.text === "string" && a.text.trim() ? a.text : null;

    case TaskType.AUDIO:
      return typeof a.file === "string" ? a.file : null;
  }
}
