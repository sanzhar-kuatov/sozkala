import { ChevronRight, ClipboardCheck, ClipboardList, Plus, School, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { cityCompletion } from "@/lib/domain/levels";
import { getReviewQueue } from "@/lib/teacher/review";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("dashboard") };
}

/** Teacher dashboard (wireframe §4.1). Detailed analytics arrive in Stage 10. */
export default async function TeacherDashboard() {
  const user = await requireRole("TEACHER");
  const t = await getTranslations("teacher.dashboard");
  const [classes, publishedTasks, queue] = await Promise.all([
    db.schoolClass.findMany({
      where: { teacherId: user.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        members: { select: { student: { select: { city: { select: { buildings: { select: { level: true } } } } } } } },
      },
    }),
    db.task.count({ where: { authorId: user.id, status: "PUBLISHED" } }),
    getReviewQueue(user),
  ]);
  const students = classes.reduce((n, c) => n + c.members.length, 0);

  const stats = [
    { icon: School, label: t("classes"), value: classes.length, tint: "bg-[#D6F3E3] text-[#1D7A48]" },
    { icon: Users, label: t("students"), value: students, tint: "bg-sky-100 text-sky-700" },
    { icon: ClipboardList, label: t("tasks"), value: publishedTasks, tint: "bg-sun-100 text-sun-700" },
    { icon: ClipboardCheck, label: t("pending"), value: queue.length, tint: "bg-violet-100 text-violet-700" },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold sm:text-3xl">{t("hello", { name: user.firstName })}</h1>
        <Link href="/teacher/tasks/new" className={buttonVariants({ variant: "accent" })}>
          <Plus aria-hidden />
          {t("newTask")}
        </Link>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ icon: Icon, label, value, tint }) => (
          <li key={label}>
            <Card className="flex items-center gap-3 p-4">
              <span className={cn("grid size-11 place-items-center rounded-md", tint)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="block font-display text-2xl font-extrabold">{value}</span>
                <span className="block text-sm font-bold text-muted">{label}</span>
              </span>
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <h2 className="text-lg font-bold">{t("yourClasses")}</h2>
          {classes.length === 0 ? (
            <p className="text-sm text-muted">
              {t("noClasses")}{" "}
              <Link href="/teacher/classes" className="font-bold text-primary-edge">
                {t("createClass")}
              </Link>
            </p>
          ) : (
            <ul className="grid gap-2">
              {classes.map((c) => {
                const completions = c.members.map((m) =>
                  cityCompletion(m.student.city?.buildings.map((b) => b.level) ?? []),
                );
                const avg = completions.length
                  ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length)
                  : 0;
                return (
                  <li key={c.id}>
                    <Link
                      href={`/teacher/classes/${c.id}`}
                      className="flex items-center gap-3 rounded-md p-2 no-underline hover:bg-cream"
                    >
                      <span className="w-20 font-extrabold text-fg">{c.name}</span>
                      <span className="text-sm text-muted">{t("studentsN", { count: c.members.length })}</span>
                      <Progress value={avg} label={t("avgCompletion")} className="h-2.5 flex-1" />
                      <span className="w-10 text-right text-sm font-extrabold text-fg">{avg}%</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="grid content-start gap-3">
          <div className="flex items-center">
            <h2 className="flex-1 text-lg font-bold">{t("queue")}</h2>
            <Link href="/teacher/review" className="inline-flex items-center gap-1 text-sm font-bold text-primary-edge">
              {t("all")}
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="text-sm text-muted">{t("queueEmpty")}</p>
          ) : (
            <ul className="grid gap-1.5">
              {queue.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/teacher/review/${a.id}`}
                    className="flex items-center gap-2 rounded-md p-2 text-sm no-underline hover:bg-cream"
                  >
                    <span className="font-bold text-fg">
                      {a.student.firstName} {a.student.lastName}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted">{a.task.title}</span>
                    <ChevronRight className="size-4 text-ink-300" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
