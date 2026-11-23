/**
 * Imports the ready-made task bank (content/task-bank/*.json) into the platform.
 *
 *   npx tsx scripts/import-task-bank.ts [options]
 *     --remote            use the hosted Turso database from .env.turso (the Vercel site)
 *     --author <login>    teacher who will own the tasks (default: teacher)
 *     --only <keys>       comma-separated task keys, e.g. grammar-v2,bridge-v1
 *     --except <keys>     skip these keys (e.g. grammar-v1 if you entered it by hand)
 *     --dry-run           validate and show what would be created, write nothing
 *
 * Safe to re-run: a task whose title already exists for that author is skipped.
 * Tasks are created PUBLISHED but not assigned — the teacher assigns them to classes.
 * Every task is validated with the same rules as the editor (parseTask).
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import type { Prisma } from "../generated/prisma/client";
import { PrismaClient } from "../generated/prisma/client";
import { gradingFor, parseTask, type TaskTypeValue } from "../lib/tasks/schemas";

type BankTask = {
  key: string;
  title: string;
  building: string;
  grade: number;
  topic: string;
  difficulty: number;
  type: TaskTypeValue;
  instruction: string;
  timeLimitMin: number | null;
  maxAttempts: number | null;
  explanation: string | null;
  content: unknown;
  answerKey: unknown;
  criteria: unknown;
};

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const list = (name: string) =>
  new Set(
    (value(name) ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

dotenv.config({ path: flag("remote") ? ".env.turso" : ".env", override: flag("remote"), quiet: true });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (flag("remote") && !url.startsWith("libsql://")) throw new Error(".env.turso must contain a libsql:// DATABASE_URL");

const authorLogin = value("author") ?? "teacher";
const only = list("only");
const except = list("except");
const dryRun = flag("dry-run");

const dir = path.join(process.cwd(), "content", "task-bank");
const tasks: BankTask[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .sort()
  .flatMap((f) => (JSON.parse(readFileSync(path.join(dir, f), "utf8")) as { tasks: BankTask[] }).tasks)
  .filter((t) => (only.size === 0 || only.has(t.key)) && !except.has(t.key));

const db = new PrismaClient({ adapter: new PrismaLibSql({ url, authToken: process.env.DATABASE_AUTH_TOKEN }) });

async function main() {
  console.log(`${dryRun ? "[dry run] " : ""}${tasks.length} task(s) → ${flag("remote") ? "Turso (live site)" : url}`);
  const author = await db.user.findUnique({ where: { login: authorLogin }, select: { id: true, role: true } });
  if (!author || (author.role !== "TEACHER" && author.role !== "ADMIN")) {
    throw new Error(`"${authorLogin}" is not a teacher account`);
  }
  const buildings = new Map(
    (await db.buildingType.findMany({ select: { id: true, key: true } })).map((b) => [b.key, b.id]),
  );

  let created = 0;
  let skipped = 0;
  for (const t of tasks) {
    // Same validation as the task editor and the seed — a broken task never reaches the database.
    const parsed = parseTask({ type: t.type, content: t.content, answerKey: t.answerKey, criteria: t.criteria });
    const buildingTypeId = buildings.get(t.building);
    if (!buildingTypeId) throw new Error(`${t.key}: unknown building ${t.building}`);
    if (t.grade < 5 || t.grade > 11) throw new Error(`${t.key}: grade ${t.grade} is outside 5–11`);

    if (await db.task.findFirst({ where: { authorId: author.id, title: t.title }, select: { id: true } })) {
      console.log(`  skip  ${t.key}  (already exists: ${t.title})`);
      skipped++;
      continue;
    }
    if (dryRun) {
      console.log(`  would create  ${t.key}  ${t.grade} класс · ${t.title}`);
      continue;
    }

    const topic =
      (await db.topic.findFirst({
        where: { authorId: author.id, title: t.topic, buildingTypeId },
        select: { id: true },
      })) ??
      (await db.topic.create({ data: { authorId: author.id, title: t.topic, buildingTypeId }, select: { id: true } }));

    await db.task.create({
      data: {
        authorId: author.id,
        topicId: topic.id,
        buildingTypeId,
        type: t.type,
        grading: gradingFor(t.type),
        status: "PUBLISHED",
        title: t.title,
        instruction: t.instruction,
        content: parsed.content as Prisma.InputJsonObject,
        answerKey: (parsed.answerKey as Prisma.InputJsonObject | null) ?? undefined,
        criteria: (parsed.criteria as Prisma.InputJsonArray | null) ?? undefined,
        explanation: t.explanation,
        grade: t.grade,
        difficulty: t.difficulty,
        timeLimitSec: t.timeLimitMin ? t.timeLimitMin * 60 : null,
        maxAttempts: t.maxAttempts,
      },
    });
    console.log(`  created  ${t.key}  ${t.grade} класс · ${t.title}`);
    created++;
  }
  console.log(`Done: ${created} created, ${skipped} skipped${dryRun ? " (dry run, nothing written)" : ""}.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
