import "server-only";
import type { BuildingKey } from "@/lib/domain/buildings";
import { cityCompletion, nextLevel } from "@/lib/domain/levels";
import { aggregateScore } from "@/lib/domain/scoring";
import { issueIfEligible } from "@/lib/certificates/service";
import { db } from "@/lib/db";
import { logError } from "@/lib/errors";
import { notify, parentsOf } from "@/lib/notifications";
import { earnedAchievements, rewardFor } from "@/lib/rewards/rules";

/** Parent gets "X% left to finish the city" when completion crosses these marks. */
const COMPLETION_MARKS = [50, 80];
/** Parent gets "N tasks done today" when the student reaches this count in a day. */
const DAILY_TASKS = 5;

export type LevelChange = { building: BuildingKey; from: number; to: number; score: number };

/**
 * Called after an attempt became GRADED (auto-graded on submit, or reviewed by
 * the teacher). Recomputes the building's aggregate score with the class's
 * scoring mode, raises the level if earned (never lowers it — spec §4), records
 * the history event and creates the notifications (spec §8).
 */
export async function applyGradedAttempt(attemptId: string): Promise<LevelChange | null> {
  const change = await applyLevels(attemptId);
  // Spec §7: the certificate is issued as soon as the requirements are met (own transaction, kept short).
  const attempt = await db.attempt.findUnique({ where: { id: attemptId }, select: { studentId: true, status: true } });
  if (attempt?.status === "GRADED") {
    await issueIfEligible(attempt.studentId).catch((error) =>
      logError(error, { where: "certificate.issue", attemptId }),
    );
  }
  return change;
}

function applyLevels(attemptId: string): Promise<LevelChange | null> {
  return db.$transaction(async (tx) => {
    const attempt = await tx.attempt.findUnique({
      where: { id: attemptId },
      select: {
        status: true,
        score: true,
        studentId: true,
        taskId: true,
        task: {
          select: {
            title: true,
            buildingTypeId: true,
            building: { select: { key: true } },
            topic: { select: { title: true } },
          },
        },
      },
    });
    if (!attempt || attempt.status !== "GRADED" || attempt.score == null) return null;
    const { studentId, task } = attempt;

    const city = await tx.city.findUnique({
      where: { studentId },
      select: {
        id: true,
        buildings: { select: { id: true, level: true, buildingTypeId: true, building: { select: { key: true } } } },
      },
    });
    if (!city) return null;

    // Class settings: scoring mode of this building + which tasks are required.
    const membership = await tx.classMember.findFirst({
      where: { studentId },
      orderBy: { joinedAt: "asc" },
      select: { classId: true },
    });
    const config = membership
      ? await tx.classBuildingConfig.findUnique({
          where: { classId_buildingTypeId: { classId: membership.classId, buildingTypeId: task.buildingTypeId } },
          select: { scoringMode: true },
        })
      : null;
    const assignments = await tx.taskAssignment.findMany({
      where: {
        task: { buildingTypeId: task.buildingTypeId },
        OR: [{ studentId }, ...(membership ? [{ classId: membership.classId }] : [])],
      },
      select: { taskId: true, isRequired: true },
    });
    const required = new Map(assignments.map((a) => [a.taskId, a.isRequired]));

    const graded = await tx.attempt.findMany({
      where: { studentId, status: "GRADED", score: { not: null }, task: { buildingTypeId: task.buildingTypeId } },
      select: { taskId: true, score: true },
    });
    const score = aggregateScore(
      config?.scoringMode ?? "BEST",
      graded.map((g) => ({ taskId: g.taskId, score: g.score!, required: required.get(g.taskId) ?? true })),
    );

    const progress =
      city.buildings.find((b) => b.buildingTypeId === task.buildingTypeId) ??
      (await tx.buildingProgress.create({
        data: { cityId: city.id, buildingTypeId: task.buildingTypeId, level: 0 },
        select: { id: true, level: true, buildingTypeId: true, building: { select: { key: true } } },
      }));
    const from = progress.level;
    const to = nextLevel(from, score);

    await tx.buildingProgress.update({ where: { id: progress.id }, data: { score, level: to } });

    const parents = await parentsOf(tx, studentId);
    const building = task.building.key as BuildingKey;

    // "Result for the topic: 8/10" (spec §8)
    await notify(
      tx,
      parents,
      "TOPIC_RESULT",
      { topic: task.topic?.title ?? task.title, score: attempt.score },
      studentId,
    );

    // "5 tasks done today" — once, when the count reaches 5
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = await tx.attempt.count({
      where: { studentId, status: { in: ["GRADED", "PENDING_REVIEW"] }, submittedAt: { gte: startOfDay } },
    });
    if (today === DAILY_TASKS) await notify(tx, parents, "DAILY_SUMMARY", { count: today }, studentId);

    const levelUp = score != null && to > from;
    const levels = city.buildings.map((b) => (b.id === progress.id ? to : b.level));

    if (levelUp) {
      await tx.buildingLevelEvent.create({
        data: { progressId: progress.id, fromLevel: from, toLevel: to, score, attemptId },
      });
      // Student: plays the build animation on the next city visit.
      await notify(tx, [studentId], "LEVEL_UP", { building, level: to });
      // Parent: "Your child built a new building!"
      if (from === 0) await notify(tx, parents, "NEW_BUILDING", { building, level: to }, studentId);

      // Parent: "20% left to finish the city"
      const before = cityCompletion(city.buildings.map((b) => b.level));
      const after = cityCompletion(levels);
      if (COMPLETION_MARKS.some((m) => before < m && after >= m)) {
        await notify(tx, parents, "COMPLETION_REMAINING", { percent: 100 - after }, studentId);
      }
    }

    // Rewards (spec §6) — for improvement only, so retakes cannot farm them.
    const previous = await tx.attempt.aggregate({
      where: { studentId, taskId: attempt.taskId, status: "GRADED", id: { not: attemptId } },
      _max: { score: true },
    });
    const reward = rewardFor({
      score: attempt.score,
      previousBest: previous._max.score,
      levelsGained: levelUp ? to - from : 0,
    });
    const ledger = (
      [
        ["POINTS", reward.points, "attempt.graded"],
        ["MATERIALS", reward.materials, "building.level_up"],
        ["STARS", reward.stars, "attempt.excellent"],
      ] as const
    ).filter(([, amount]) => amount > 0);
    if (ledger.length) {
      await tx.rewardTransaction.createMany({
        data: ledger.map(([kind, amount, reason]) => ({ studentId, kind, amount, reason, attemptId })),
      });
      await tx.city.update({
        where: { id: city.id },
        data: {
          points: { increment: reward.points },
          materials: { increment: reward.materials },
          stars: { increment: reward.stars },
        },
      });
    }

    // Achievements (spec §6: «Сөз сәулетшісі», «Емле шебері», …)
    const [allAchievements, earned, history] = await Promise.all([
      tx.achievement.findMany({ select: { id: true, key: true, rule: true } }),
      tx.studentAchievement.findMany({ where: { studentId }, select: { achievementId: true } }),
      tx.attempt.findMany({
        where: { studentId, status: "GRADED", score: { not: null } },
        orderBy: [{ gradedAt: "asc" }, { number: "asc" }],
        select: { taskId: true, score: true },
      }),
    ]);
    const have = new Set(earned.map((e) => e.achievementId));
    const keyByTypeId = new Map(city.buildings.map((b) => [b.buildingTypeId, b.building.key as BuildingKey]));
    const newKeys = earnedAchievements(
      allAchievements.filter((a) => !have.has(a.id)),
      {
        levels: Object.fromEntries(city.buildings.map((b, i) => [keyByTypeId.get(b.buildingTypeId)!, levels[i]])),
        results: history.map((h) => ({ taskId: h.taskId, score: h.score! })),
      },
    );
    for (const key of newKeys) {
      const a = allAchievements.find((x) => x.key === key)!;
      await tx.studentAchievement.create({ data: { studentId, achievementId: a.id } });
      await notify(tx, [studentId], "ACHIEVEMENT_EARNED", { achievement: key, attemptId });
    }

    return levelUp ? { building, from, to, score: score! } : null;
  });
}
