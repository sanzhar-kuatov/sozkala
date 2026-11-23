import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TaskEditor } from "@/components/teacher/task-editor";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { blankQuestion, defaultCriteria } from "@/lib/tasks/authoring";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("teacher.tasks");
  return { title: t("new") };
}

export default async function NewTaskPage() {
  const user = await requireRole("TEACHER");
  const t = await getTranslations("teacher.tasks");
  const [topics, firstClass] = await Promise.all([
    db.topic.findMany({
      where: { authorId: user.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true, building: { select: { key: true } } },
    }),
    // default grade = the grade the teacher teaches (first active class)
    db.schoolClass.findFirst({
      where: { teacherId: user.id, archivedAt: null },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      select: { grade: true },
    }),
  ]);

  return (
    <div className="grid gap-4">
      <Link href="/teacher/tasks" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("new")}</h1>
      <TaskEditor
        taskId={null}
        locked={false}
        topics={topics.map((tp) => ({ id: tp.id, title: tp.title, building: tp.building?.key ?? null }))}
        initialMeta={{
          title: "",
          instruction: "",
          type: "SINGLE_CHOICE",
          building: "grammar",
          topicId: null,
          grade: firstClass?.grade ?? 5,
          difficulty: 2,
          timeLimitMin: 10,
          maxAttempts: 3,
          explanation: "",
        }}
        initialDraft={{
          passage: "",
          source: "",
          questions: [blankQuestion("SINGLE_CHOICE")],
          criteria: defaultCriteria(),
        }}
      />
    </div>
  );
}
