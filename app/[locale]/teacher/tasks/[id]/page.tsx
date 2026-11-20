import { Archive, ArrowLeft, Copy, EyeOff, Send, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { TaskEditor } from "@/components/teacher/task-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { BuildingKey } from "@/lib/domain/buildings";
import { toDraft } from "@/lib/tasks/authoring";
import type { TaskTypeValue } from "@/lib/tasks/schemas";
import { getTaskForEditor } from "@/lib/teacher/tasks";
import { deleteTask, duplicateTask, setTaskStatus } from "../actions";
import { AssignmentsPanel, MaterialsPanel } from "./panels";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teacher.tasks");
  return { title: t("edit") };
}

export default async function EditTaskPage({ params }: PageProps<"/[locale]/teacher/tasks/[id]">) {
  const { id } = await params;
  const user = await requireRole("TEACHER");
  const task = await getTaskForEditor(user, id).catch(() => null);
  if (!task) notFound();

  const t = await getTranslations("teacher.tasks");
  const format = await getFormatter();
  const [topics, classes] = await Promise.all([
    db.topic.findMany({
      where: { authorId: user.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, building: { select: { key: true } } },
    }),
    db.schoolClass.findMany({
      where: { teacherId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: { select: { student: { select: { id: true, firstName: true, lastName: true } } } },
      },
    }),
  ]);
  const locked = task._count.attempts > 0;
  const type = task.type as TaskTypeValue;
  const draft = toDraft(
    type,
    task.content as never,
    (task.answerKey ?? null) as never,
    (task.criteria ?? null) as never,
  );

  return (
    <div className="grid gap-4">
      <Link href="/teacher/tasks" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-extrabold sm:text-3xl">{task.title}</h1>
        <Chip tone={task.status === "PUBLISHED" ? "auto" : task.status === "DRAFT" ? "warning" : "neutral"}>
          {t(`statuses.${task.status}`)}
        </Chip>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TaskEditor
          taskId={task.id}
          locked={locked}
          topics={topics.map((tp) => ({ id: tp.id, title: tp.title, building: tp.building?.key ?? null }))}
          initialMeta={{
            title: task.title,
            instruction: task.instruction,
            type,
            building: task.building.key as BuildingKey,
            topicId: task.topicId,
            difficulty: task.difficulty,
            timeLimitMin: task.timeLimitSec ? Math.round(task.timeLimitSec / 60) : null,
            maxAttempts: task.maxAttempts,
            explanation: task.explanation ?? "",
          }}
          initialDraft={draft}
        />

        <div className="grid content-start gap-4">
          <Card className="grid gap-2">
            <h2 className="text-lg font-bold">{t("statusTitle")}</h2>
            <p className="text-sm text-muted">{t("submissions", { count: task._count.attempts })}</p>
            <div className="flex flex-wrap gap-2">
              {task.status !== "PUBLISHED" && (
                <form action={setTaskStatus.bind(null, task.id, "PUBLISHED")}>
                  <Button type="submit" size="sm" variant="success">
                    <Send aria-hidden />
                    {t("publish")}
                  </Button>
                </form>
              )}
              {task.status === "PUBLISHED" && (
                <form action={setTaskStatus.bind(null, task.id, "DRAFT")}>
                  <Button type="submit" size="sm" variant="ghost">
                    <EyeOff aria-hidden />
                    {t("unpublish")}
                  </Button>
                </form>
              )}
              <form action={duplicateTask.bind(null, task.id)}>
                <Button type="submit" size="sm" variant="ghost">
                  <Copy aria-hidden />
                  {t("duplicate")}
                </Button>
              </form>
              <form action={deleteTask.bind(null, task.id)}>
                <Button type="submit" size="sm" variant="ghost">
                  {locked ? <Archive aria-hidden /> : <Trash2 aria-hidden />}
                  {locked ? t("archive") : t("delete")}
                </Button>
              </form>
            </div>
          </Card>
          <Card>
            <AssignmentsPanel
              taskId={task.id}
              assignments={task.assignments.map((a) => ({
                id: a.id,
                isRequired: a.isRequired,
                deadline: a.deadline
                  ? format.dateTime(a.deadline, { day: "2-digit", month: "2-digit", year: "numeric" })
                  : null,
                label: a.class ? a.class.name : `${a.student?.lastName} ${a.student?.firstName}`,
              }))}
              targets={[
                ...classes.map((c) => ({ value: `class:${c.id}`, label: c.name, group: "class" as const })),
                ...classes.flatMap((c) =>
                  c.members.map((m) => ({
                    value: `student:${m.student.id}`,
                    label: `${m.student.lastName} ${m.student.firstName} (${c.name})`,
                    group: "student" as const,
                  })),
                ),
              ]}
            />
          </Card>
          <Card>
            <MaterialsPanel
              taskId={task.id}
              materials={task.materials.map((m) => ({
                id: m.id,
                kind: m.kind,
                title: m.title,
                sizeBytes: m.sizeBytes,
              }))}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
