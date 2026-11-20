import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CreateTopicForm, TopicRow } from "./topic-forms";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("topics") };
}

/** Topics (spec §2.2 "manage learning topics"); used to group tasks and in analytics. */
export default async function TopicsPage() {
  const user = await requireRole("TEACHER");
  const t = await getTranslations("teacher.topics");
  const topics = await db.topic.findMany({
    where: { authorId: user.id },
    orderBy: [{ building: { sortOrder: "asc" } }, { title: "asc" }],
    select: { id: true, title: true, building: { select: { key: true } }, _count: { select: { tasks: true } } },
  });

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
      <Card>
        <CreateTopicForm />
      </Card>
      {topics.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid gap-2">
          {topics.map((topic) => (
            <li key={topic.id}>
              <TopicRow
                id={topic.id}
                title={topic.title}
                building={topic.building?.key ?? ""}
                taskCount={topic._count.tasks}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
