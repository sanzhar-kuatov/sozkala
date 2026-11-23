import "server-only";
import type { ScoringMode } from "@/generated/prisma/enums";
import { assertCanViewStudent } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { cityCompletion } from "@/lib/domain/levels";
import type { PlacedDecoration } from "@/components/city/engine/decorations";
import { placedDecorations } from "./rewards";

export type BuildingState = {
  key: BuildingKey;
  level: number;
  score: number | null;
  scoringMode: ScoringMode;
  required: boolean;
  /** null = open; otherwise the building that must reach `minLevel` first */
  lockedBy: { key: BuildingKey; minLevel: number } | null;
  tasks: { total: number; done: number; pending: number; required: number };
};

export type CityView = {
  student: { id: string; firstName: string; lastName: string };
  city: { id: string; name: string; points: number; materials: number; stars: number };
  buildings: BuildingState[];
  completion: number;
  /** Placed decorations (cosmetic). */
  decorations: PlacedDecoration[];
  /** Unread "level up" notifications → the city plays the build animation for them once. */
  levelUps: { id: string; key: BuildingKey; level: number }[];
};

/**
 * Ids of published tasks assigned to the student (via their classes or personally),
 * limited to the grades the student studies in: a 5th-grader never gets a 6th-grade
 * task, even if an assignment slipped through.
 */
export async function assignedTaskIds(studentId: string) {
  const memberships = await db.classMember.findMany({
    where: { studentId },
    select: { classId: true, class: { select: { grade: true } } },
  });
  const classIds = memberships.map((m) => m.classId);
  const grades = [...new Set(memberships.map((m) => m.class.grade))];
  const assignments = await db.taskAssignment.findMany({
    where: {
      OR: [{ classId: { in: classIds } }, { studentId }],
      task: { status: "PUBLISHED", grade: { in: grades } },
    },
    select: { taskId: true, isRequired: true, deadline: true },
  });
  return { classIds, assignments };
}

/**
 * Everything the city screen needs for one student. Authorization: the viewer
 * must be allowed to see this student (self, linked parent, their teacher, admin).
 */
export async function getCityView(viewer: SessionUser, studentId: string): Promise<CityView | null> {
  await assertCanViewStudent(viewer, studentId);

  const student = await db.user.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      city: {
        select: {
          id: true,
          name: true,
          points: true,
          materials: true,
          stars: true,
          buildings: { select: { level: true, score: true, building: { select: { key: true } } } },
        },
      },
    },
  });
  if (!student?.city) return null;

  const { classIds, assignments } = await assignedTaskIds(studentId);
  const taskIds = assignments.map((a) => a.taskId);
  const requiredIds = new Set(assignments.filter((a) => a.isRequired).map((a) => a.taskId));

  const [tasks, attempts, configs, levelUps] = await Promise.all([
    db.task.findMany({ where: { id: { in: taskIds } }, select: { id: true, building: { select: { key: true } } } }),
    db.attempt.findMany({
      where: { studentId, taskId: { in: taskIds }, status: { in: ["GRADED", "PENDING_REVIEW"] } },
      select: { taskId: true, status: true },
    }),
    // The first class's settings apply (a student is normally in one class).
    classIds.length
      ? db.classBuildingConfig.findMany({
          where: { classId: classIds[0] },
          select: {
            scoringMode: true,
            isRequired: true,
            unlockMinLevel: true,
            building: { select: { key: true } },
            unlockAfter: { select: { key: true } },
          },
        })
      : Promise.resolve([]),
    viewer.id === studentId
      ? db.notification.findMany({
          where: { recipientId: studentId, type: "LEVEL_UP", readAt: null },
          orderBy: { createdAt: "asc" },
          select: { id: true, payload: true },
        })
      : Promise.resolve([]),
  ]);

  const progress = new Map(student.city.buildings.map((b) => [b.building.key, b]));
  const config = new Map(configs.map((c) => [c.building.key, c]));
  const levelOf = (key: string) => progress.get(key)?.level ?? 0;

  const buildings: BuildingState[] = BUILDINGS.map(({ key }) => {
    const own = tasks.filter((t) => t.building.key === key).map((t) => t.id);
    const done = new Set(attempts.filter((a) => a.status === "GRADED" && own.includes(a.taskId)).map((a) => a.taskId));
    const pending = new Set(
      attempts
        .filter((a) => a.status === "PENDING_REVIEW" && own.includes(a.taskId) && !done.has(a.taskId))
        .map((a) => a.taskId),
    );
    const cfg = config.get(key);
    const after = cfg?.unlockAfter?.key as BuildingKey | undefined;
    const locked = after && levelOf(after) < (cfg?.unlockMinLevel ?? 0) && levelOf(key) === 0;
    return {
      key,
      level: levelOf(key),
      score: progress.get(key)?.score ?? null,
      scoringMode: cfg?.scoringMode ?? "BEST",
      required: cfg?.isRequired ?? true,
      lockedBy: locked ? { key: after, minLevel: cfg!.unlockMinLevel } : null,
      tasks: {
        total: own.length,
        done: done.size,
        pending: pending.size,
        required: own.filter((id) => requiredIds.has(id)).length,
      },
    };
  });

  return {
    student: { id: student.id, firstName: student.firstName, lastName: student.lastName },
    city: {
      id: student.city.id,
      name: student.city.name,
      points: student.city.points,
      materials: student.city.materials,
      stars: student.city.stars,
    },
    buildings,
    completion: cityCompletion(buildings.map((b) => b.level)),
    decorations: await placedDecorations(student.city.id),
    levelUps: levelUps.flatMap((n) => {
      const p = n.payload as { building?: string; level?: number };
      return p.building && BUILDINGS.some((b) => b.key === p.building)
        ? [{ id: n.id, key: p.building as BuildingKey, level: p.level ?? levelOf(p.building) }]
        : [];
    }),
  };
}
