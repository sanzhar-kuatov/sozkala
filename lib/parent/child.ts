import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { BuildingKey } from "@/lib/domain/buildings";
import { getCityView } from "@/lib/student/city";

/** Children linked to a parent (spec §2.3: a parent sees only linked children). */
export async function linkedChildren(parent: SessionUser) {
  const links = await db.parentLink.findMany({
    where: { parentId: parent.id },
    orderBy: { createdAt: "asc" },
    select: {
      student: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          memberships: { take: 1, select: { class: { select: { name: true } } } },
        },
      },
    },
  });
  return links.map((l) => ({
    id: l.student.id,
    name: `${l.student.firstName} ${l.student.lastName}`,
    className: l.student.memberships[0]?.class.name ?? null,
  }));
}

/** Everything the parent sees about one child — read-only (spec §2.3, §9). */
export async function getChildOverview(viewer: SessionUser, childId: string) {
  const city = await getCityView(viewer, childId); // throws FORBIDDEN unless linked
  if (!city) return null;

  const [attempts, events, badges] = await Promise.all([
    db.attempt.findMany({
      where: { studentId: childId, status: { in: ["GRADED", "PENDING_REVIEW"] } },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        score: true,
        submittedAt: true,
        taskId: true,
        task: { select: { title: true, topic: { select: { title: true } }, building: { select: { key: true } } } },
      },
    }),
    db.buildingLevelEvent.findMany({
      where: { progress: { city: { studentId: childId } } },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        fromLevel: true,
        toLevel: true,
        score: true,
        createdAt: true,
        progress: { select: { building: { select: { key: true } } } },
      },
    }),
    db.studentAchievement.count({ where: { studentId: childId } }),
  ]);

  const graded = attempts.filter((a) => a.status === "GRADED" && a.score != null);
  const average = graded.length
    ? Math.round((graded.reduce((s, a) => s + a.score!, 0) / graded.length) * 10) / 10
    : null;

  // Difficult topics: average below 6/10 (spec §2.3 "difficult topics").
  const byTopic = new Map<string, number[]>();
  for (const a of graded) {
    const key = a.task.topic?.title ?? a.task.title;
    byTopic.set(key, [...(byTopic.get(key) ?? []), a.score!]);
  }
  const topics = [...byTopic]
    .map(([title, s]) => ({
      title,
      average: Math.round((s.reduce((x, y) => x + y, 0) / s.length) * 10) / 10,
      attempts: s.length,
    }))
    .sort((a, b) => a.average - b.average);

  return {
    city,
    stats: {
      average,
      tasksDone: new Set(graded.map((a) => a.taskId)).size,
      pending: attempts.filter((a) => a.status === "PENDING_REVIEW").length,
      badges,
    },
    difficult: topics.filter((t) => t.average < 6).slice(0, 5),
    topics,
    recent: attempts.slice(0, 10).map((a) => ({
      id: a.id,
      status: a.status,
      score: a.score,
      at: a.submittedAt,
      title: a.task.title,
      building: a.task.building.key as BuildingKey,
    })),
    history: events.map((e) => ({
      building: e.progress.building.key as BuildingKey,
      from: e.fromLevel,
      to: e.toLevel,
      score: e.score,
      at: e.createdAt,
    })),
  };
}
