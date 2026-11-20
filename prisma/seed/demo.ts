/**
 * Demo school for development and acceptance testing: one teacher, class 7«Ә»
 * with 5 students, 2 parents, 14 tasks and two weeks of learning history.
 *
 * Re-running the seed deletes and recreates ONLY the demo data (fixed school id
 * and demo logins). Skip it with SEED_DEMO=false (e.g. on a real installation).
 */
import type { PrismaClient } from "../../generated/prisma/client";
import {
  AttemptStatus,
  GradingMode,
  NotificationType,
  RewardKind,
  Role,
  ScoringMode,
  TaskStatus,
} from "../../generated/prisma/enums";
import { hashPassword } from "../../lib/auth/password";
import { BUILDINGS, type BuildingKey } from "../../lib/domain/buildings";
import { cityCompletion, nextLevel } from "../../lib/domain/levels";
import { aggregateScore } from "../../lib/domain/scoring";
import { earnedAchievements, rewardFor } from "../../lib/rewards/rules";
import { gradingFor, parseTask } from "../../lib/tasks/schemas";
import { DEMO_TASKS, DEMO_TOPICS } from "./demo-tasks";

const SCHOOL_ID = "demo-school";
const CLASS_ID = "demo-class-7a";
const INVITE_CODE = "SOZ7A1";

type Person = { login: string; firstName: string; lastName: string; cityName?: string };

const TEACHER: Person = { login: "teacher", firstName: "Гүлмира", lastName: "Ахметова" };
const STUDENTS: Person[] = [
  { login: "aruzhan", firstName: "Аружан", lastName: "Қасымова", cityName: "Аружан-қала" },
  { login: "damir", firstName: "Дамир", lastName: "Серікұлы", cityName: "Дамирград" },
  { login: "alina", firstName: "Алина", lastName: "Ким", cityName: "Алинаполис" },
  { login: "timur", firstName: "Тимур", lastName: "Жақсылықов", cityName: "Тимур-қала" },
  { login: "madina", firstName: "Мадина", lastName: "Оспанова", cityName: "Мадина-қала" },
];
const PARENTS: (Person & { child: string })[] = [
  { login: "parent", firstName: "Сәуле", lastName: "Қасымова", child: "aruzhan" },
  { login: "parent2", firstName: "Серік", lastName: "Әбенов", child: "damir" },
];
const ALL_LOGINS = [TEACHER, ...STUDENTS, ...PARENTS].map((p) => p.login);

/** Learning history: [task key, score or "pending" (waiting for the teacher), days ago]. */
type Step = [task: string, score: number | "pending", daysAgo: number];
const HISTORY: Record<string, Step[]> = {
  aruzhan: [
    ["nn-adjectives", 5, 12],
    ["nn-adjectives", 7, 9], // retake → the palace grows from L2 to L3 (spec §13)
    ["idioms", 9, 8],
    ["lighthouse", 4, 7],
    ["devices", 10, 5],
    ["captains-daughter-heroes", 6, 4],
    ["commas-spp", 2, 3],
    ["lexical-meaning", 8, 2],
    ["essay-hero", "pending", 1],
  ],
  damir: [
    ["nn-adjectives", 8, 6],
    ["idioms", 6, 5],
    ["devices", 7, 3],
    ["lighthouse", 9, 2],
    ["creative-lighthouse", "pending", 1],
  ],
  alina: [
    ["nn-adjectives", 10, 10],
    ["pre-pri", 9, 9],
    ["commas-spp", 7, 6],
    ["word-order", 8, 6],
    ["essay-hero", 8, 5],
    ["captains-daughter-heroes", 8, 4],
    ["idioms", 9, 3],
    ["devices", 9, 2],
    ["lighthouse", 7, 2],
    ["reading-aloud", 8, 1],
    // Only the town hall's final task is left before the certificate (Stage 11 e2e finishes it).
  ],
  timur: [], // empty city — the "first login" state
  madina: [
    ["nn-adjectives", 3, 4],
    ["essay-hero", "pending", 2],
  ],
};

const ESSAY_TEXT =
  "Мой любимый литературный герой — Пётр Гринёв из повести А. С. Пушкина «Капитанская дочка». Он близок мне тем, что умеет оставаться честным в самых трудных обстоятельствах. Отец сказал ему: «Береги честь смолоду», и Гринёв выполнил этот наказ. Когда Пугачёв предлагает ему служить, герой отказывается, хотя рискует жизнью. При этом он добрый человек: подарил тулуп незнакомому бродяге и не пожалел об этом. Мне кажется, Гринёв показывает, что смелость — это не только сила, но и верность своему слову. Я хотела бы быть такой же честной.";

const CREATIVE_TEXT =
  "Однажды ночью свет маяка погас. Смотритель проснулся от странной тишины: не было слышно гудения фонаря. Он схватил старую керосиновую лампу и побежал вверх по ступеням. На море поднимался туман, а вдалеке гудел корабль. Старик поставил лампу у окна и всю ночь раскачивал её, чтобы моряки заметили огонёк. Утром к берегу подошла рыбацкая лодка, и капитан впервые узнал имя смотрителя.";

/** Task keys that are required for the class (the rest are optional extras). */
const REQUIRED = new Set(DEMO_TASKS.filter((t) => t.required).map((t) => t.key));

const day = 24 * 60 * 60 * 1000;
const daysAgo = (n: number, hour = 16) => {
  const d = new Date(Date.now() - n * day);
  d.setHours(hour, (n * 7) % 60, 0, 0);
  // Past events are never in the future (e.g. "today at 19:00" when seeding in the morning).
  // Negative n is used on purpose for future dates (deadlines).
  return n >= 0 && d.getTime() > Date.now() ? new Date(Date.now() - 10 * 60 * 1000) : d;
};

export async function seedDemo(db: PrismaClient) {
  await deleteDemo(db);

  const password = await hashPassword(process.env.SEED_DEMO_PASSWORD ?? "demo12345");
  const buildingRows = await db.buildingType.findMany({ select: { id: true, key: true } });
  const buildings = {} as Record<BuildingKey, { id: string }>;
  for (const b of BUILDINGS) {
    const row = buildingRows.find((r) => r.key === b.key);
    if (!row) throw new Error(`building "${b.key}" is missing — run the reference seed first`);
    buildings[b.key] = row;
  }

  // ---- school, people, class ------------------------------------------------
  await db.school.create({ data: { id: SCHOOL_ID, name: "Демо мектеп-гимназиясы", city: "Алматы" } });

  const createUser = (p: Person, role: Role) =>
    db.user.create({
      data: {
        login: p.login,
        passwordHash: password,
        role,
        firstName: p.firstName,
        lastName: p.lastName,
        schoolId: SCHOOL_ID,
      },
    });

  const teacher = await createUser(TEACHER, Role.TEACHER);
  const students: Record<string, { id: string; cityId: string; person: Person }> = {};
  for (const s of STUDENTS) {
    const user = await createUser(s, Role.STUDENT);
    const city = await db.city.create({ data: { studentId: user.id, name: s.cityName ?? s.firstName } });
    students[s.login] = { id: user.id, cityId: city.id, person: s };
  }
  const parents: Record<string, string> = {};
  for (const p of PARENTS) {
    const user = await createUser(p, Role.PARENT);
    parents[p.login] = user.id;
    await db.parentLink.create({ data: { parentId: user.id, studentId: students[p.child].id } });
  }

  await db.schoolClass.create({
    data: {
      id: CLASS_ID,
      schoolId: SCHOOL_ID,
      teacherId: teacher.id,
      name: "7«Ә»",
      grade: 7,
      academicYear: "2026-2027",
      inviteCode: INVITE_CODE,
      members: { create: Object.values(students).map((s) => ({ studentId: s.id, joinedAt: daysAgo(14, 9) })) },
    },
  });

  // §3: per-class building settings. The town hall (final tasks) opens after the palace reaches L2.
  for (const [i, b] of BUILDINGS.entries()) {
    await db.classBuildingConfig.create({
      data: {
        classId: CLASS_ID,
        buildingTypeId: buildings[b.key].id,
        unlockOrder: i + 1,
        isRequired: true,
        scoringMode: b.key === "library" ? ScoringMode.AVERAGE : ScoringMode.BEST,
        unlockAfterId: b.key === "townhall" ? buildings.grammar.id : null,
        unlockMinLevel: 2,
      },
    });
  }

  // ---- topics and tasks -----------------------------------------------------
  const topicIds: Record<string, string> = {};
  for (const t of DEMO_TOPICS) {
    const topic = await db.topic.create({
      data: {
        authorId: teacher.id,
        buildingTypeId: buildings[t.building].id,
        title: t.title,
        description: t.description,
      },
    });
    topicIds[t.key] = topic.id;
  }

  const tasks: Record<string, { id: string; building: BuildingKey; grading: GradingMode; criteria: unknown }> = {};
  for (const t of DEMO_TASKS) {
    const parsed = parseTask({ type: t.type, content: t.content, answerKey: t.answerKey, criteria: t.criteria });
    const task = await db.task.create({
      data: {
        authorId: teacher.id,
        topicId: topicIds[t.topic],
        buildingTypeId: buildings[t.building].id,
        type: t.type,
        grading: gradingFor(t.type),
        status: TaskStatus.PUBLISHED,
        title: t.title,
        instruction: t.instruction,
        content: parsed.content,
        answerKey: parsed.answerKey ?? undefined,
        criteria: parsed.criteria ?? undefined,
        explanation: t.explanation,
        difficulty: t.difficulty,
        timeLimitSec: t.timeLimitSec,
        maxAttempts: t.maxAttempts,
        createdAt: daysAgo(15, 10),
        assignments: {
          create: {
            classId: CLASS_ID,
            assignedById: teacher.id,
            isRequired: t.required,
            deadline: daysAgo(-14, 23),
            createdAt: daysAgo(14, 10),
          },
        },
      },
    });
    tasks[t.key] = { id: task.id, building: t.building, grading: task.grading, criteria: parsed.criteria };
  }

  // ---- learning history → attempts, building levels, rewards ----------------
  for (const [login, steps] of Object.entries(HISTORY)) {
    await replayHistory(db, students[login], steps, tasks, buildings, teacher.id);
  }

  // ---- notifications ----------------------------------------------------------
  await seedNotifications(db, students, parents, teacher.id);

  await db.auditLog.create({
    data: { action: "seed.demo", entity: "School", entityId: SCHOOL_ID, data: { students: STUDENTS.length } },
  });

  console.log(
    `  demo: school, class 7«Ә» (invite ${INVITE_CODE}), ${STUDENTS.length} students, ${PARENTS.length} parents, ${DEMO_TASKS.length} tasks`,
  );
}

/** Deletes previous demo data (in an order that respects the Restrict relations). */
async function deleteDemo(db: PrismaClient) {
  const users = await db.user.findMany({ where: { login: { in: ALL_LOGINS } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  await db.task.deleteMany({ where: { authorId: { in: ids } } });
  await db.topic.deleteMany({ where: { authorId: { in: ids } } });
  await db.school.deleteMany({ where: { id: SCHOOL_ID } });
  await db.attemptAllowance.deleteMany({ where: { grantedById: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

/**
 * Creates attempts in chronological order and grows buildings exactly as the
 * real grading will (Stage 6): BEST mode = average of the best score per task;
 * AVERAGE mode = average of all graded attempts; a level never goes down.
 */
async function replayHistory(
  db: PrismaClient,
  student: { id: string; cityId: string },
  steps: Step[],
  tasks: Record<string, { id: string; building: BuildingKey; grading: GradingMode; criteria: unknown }>,
  buildings: Record<BuildingKey, { id: string }>,
  teacherId: string,
) {
  const attemptNo: Record<string, number> = {};
  const graded: { task: string; building: BuildingKey; score: number }[] = [];
  const levels = Object.fromEntries(BUILDINGS.map((b) => [b.key, 0])) as Record<BuildingKey, number>;
  const scores: Partial<Record<BuildingKey, number>> = {};
  const events: { building: BuildingKey; from: number; to: number; score: number; attemptId: string; at: Date }[] = [];
  let points = 0;
  let materials = 0;
  let stars = 0;

  for (const [key, result, ago] of steps) {
    const task = tasks[key];
    const number = (attemptNo[key] = (attemptNo[key] ?? 0) + 1);
    const startedAt = daysAgo(ago, 15);
    const submittedAt = new Date(startedAt.getTime() + 9 * 60 * 1000);
    const manual = task.grading === GradingMode.MANUAL;
    const text = key === "creative-lighthouse" ? CREATIVE_TEXT : ESSAY_TEXT;

    if (result === "pending") {
      await db.attempt.create({
        data: {
          taskId: task.id,
          studentId: student.id,
          number,
          status: AttemptStatus.PENDING_REVIEW,
          answers: { q1: { text } },
          startedAt,
          submittedAt,
        },
      });
      continue;
    }

    const gradedAt = manual ? new Date(submittedAt.getTime() + day / 2) : submittedAt;
    const attempt = await db.attempt.create({
      data: {
        taskId: task.id,
        studentId: student.id,
        number,
        status: AttemptStatus.GRADED,
        // Demo history stores no per-question answers for auto-graded tasks; only the score.
        answers: manual && key !== "reading-aloud" ? { q1: { text } } : {},
        autoScore: manual ? null : result,
        manualScore: manual ? result : null,
        rubric: !manual
          ? undefined
          : key === "reading-aloud"
            ? { expression: 3, pronunciation: 3, pace: 2 }
            : { content: 3, literacy: 2, structure: 3 },
        score: result,
        feedback: manual ? "Хорошая работа! Обратите внимание на запятые в сложных предложениях." : null,
        startedAt,
        submittedAt,
        gradedAt,
        gradedById: manual ? teacherId : null,
      },
    });

    const previousBest = Math.max(-1, ...graded.filter((g) => g.task === key).map((g) => g.score));
    graded.push({ task: key, building: task.building, score: result });
    const b = task.building;
    const aggregate = aggregateScore(
      b === "library" ? "AVERAGE" : "BEST",
      graded
        .filter((g) => g.building === b)
        .map((g) => ({ taskId: g.task, score: g.score, required: REQUIRED.has(g.task) })),
    )!;
    scores[b] = aggregate;
    const to = nextLevel(levels[b], aggregate);
    const gained = Math.max(0, to - levels[b]);
    if (gained > 0) {
      events.push({ building: b, from: levels[b], to, score: aggregate, attemptId: attempt.id, at: gradedAt });
      levels[b] = to;
    }

    // Same reward rules as live grading (lib/rewards/rules.ts).
    const reward = rewardFor({
      score: result,
      previousBest: previousBest < 0 ? null : previousBest,
      levelsGained: gained,
    });
    points += reward.points;
    materials += reward.materials;
    stars += reward.stars;
    for (const [kind, amount, reason] of [
      [RewardKind.POINTS, reward.points, "attempt.graded"],
      [RewardKind.MATERIALS, reward.materials, "building.level_up"],
      [RewardKind.STARS, reward.stars, "attempt.excellent"],
    ] as const) {
      if (amount > 0)
        await db.rewardTransaction.create({
          data: { studentId: student.id, kind, amount, reason, attemptId: attempt.id, createdAt: gradedAt },
        });
    }
  }

  for (const b of BUILDINGS) {
    const progress = await db.buildingProgress.create({
      data: {
        cityId: student.cityId,
        buildingTypeId: buildings[b.key].id,
        level: levels[b.key],
        score: scores[b.key] ?? null,
      },
    });
    for (const e of events.filter((x) => x.building === b.key)) {
      await db.buildingLevelEvent.create({
        data: {
          progressId: progress.id,
          fromLevel: e.from,
          toLevel: e.to,
          score: e.score,
          attemptId: e.attemptId,
          createdAt: e.at,
        },
      });
    }
  }

  await db.city.update({ where: { id: student.cityId }, data: { points, materials, stars } });

  // Achievements that follow from this history (same rules as live grading).
  const achievements = await db.achievement.findMany({ select: { id: true, key: true, rule: true } });
  const earned = earnedAchievements(achievements, {
    levels,
    results: graded.map((g) => ({ taskId: g.task, score: g.score })),
  });
  for (const key of earned) {
    const a = achievements.find((x) => x.key === key)!;
    await db.studentAchievement.create({ data: { studentId: student.id, achievementId: a.id, earnedAt: daysAgo(1) } });
  }

  return { levels, events };
}

async function seedNotifications(
  db: PrismaClient,
  students: Record<string, { id: string; cityId: string; person: Person }>,
  parents: Record<string, string>,
  teacherId: string,
) {
  for (const p of PARENTS) {
    const child = students[p.child];
    const progress = await db.buildingProgress.findMany({
      where: { cityId: child.cityId },
      include: { building: true, events: true },
    });
    const notes: { type: NotificationType; payload: object; at: Date; read: boolean }[] = [];

    // «Балаңыз жаңа ғимарат салды!» for every building that left the empty-lot stage.
    for (const pr of progress) {
      const first = pr.events.find((e) => e.fromLevel === 0);
      if (first)
        notes.push({
          type: NotificationType.NEW_BUILDING,
          payload: { building: pr.building.key, level: first.toLevel },
          at: first.createdAt,
          read: true,
        });
    }
    const latest = await db.attempt.findFirst({
      where: { studentId: child.id, status: AttemptStatus.GRADED },
      orderBy: { gradedAt: "desc" },
      include: { task: { include: { topic: true } } },
    });
    if (latest?.score != null) {
      notes.push({
        type: NotificationType.TOPIC_RESULT,
        payload: { topic: latest.task.topic?.title ?? latest.task.title, score: latest.score },
        at: latest.gradedAt ?? new Date(),
        read: false,
      });
    }
    const today = await db.attempt.count({ where: { studentId: child.id, submittedAt: { gte: daysAgo(2, 0) } } });
    notes.push({ type: NotificationType.DAILY_SUMMARY, payload: { count: today }, at: daysAgo(0, 19), read: false });
    const completion = cityCompletion(progress.map((pr) => pr.level));
    notes.push({
      type: NotificationType.COMPLETION_REMAINING,
      payload: { percent: 100 - completion },
      at: daysAgo(0, 19),
      read: false,
    });

    for (const n of notes) {
      await db.notification.create({
        data: {
          recipientId: parents[p.login],
          subjectId: child.id,
          type: n.type,
          payload: n.payload,
          createdAt: n.at,
          readAt: n.read ? n.at : null,
        },
      });
    }
  }

  // Student: level-up messages for their newest level change.
  for (const s of Object.values(students)) {
    const e = await db.buildingLevelEvent.findFirst({
      where: { progress: { cityId: s.cityId } },
      orderBy: { createdAt: "desc" },
      include: { progress: { include: { building: true } } },
    });
    if (e) {
      await db.notification.create({
        data: {
          recipientId: s.id,
          type: NotificationType.LEVEL_UP,
          payload: { building: e.progress.building.key, level: e.toLevel },
          createdAt: e.createdAt,
        },
      });
    }
  }

  // Teacher: one "review needed" per pending work.
  const pending = await db.attempt.findMany({
    where: { status: AttemptStatus.PENDING_REVIEW, task: { authorId: teacherId } },
  });
  for (const a of pending) {
    await db.notification.create({
      data: {
        recipientId: teacherId,
        subjectId: a.studentId,
        type: NotificationType.REVIEW_NEEDED,
        payload: { attemptId: a.id, taskId: a.taskId },
        createdAt: a.submittedAt ?? new Date(),
      },
    });
  }
}
