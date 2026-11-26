import { Archive, ArchiveRestore, ArrowLeft, ChevronRight, Landmark, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { env } from "@/lib/env";
import { getClassDetail } from "@/lib/teacher/classes";
import { ConfirmForm } from "@/components/teacher/confirm-form";
import { deleteClass, setClassArchived } from "../actions";
import { AddStudentForm, InviteCard, StudentActions } from "./class-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("classes") };
}

/** One class: invite code, students with progress, parents (spec §2.2). */
export default async function ClassPage({ params }: PageProps<"/[locale]/teacher/classes/[id]">) {
  const { id } = await params;
  const user = await requireRole("TEACHER");
  const klass = await getClassDetail(user, id).catch(() => null);
  if (!klass) notFound();
  const t = await getTranslations("teacher.classes");
  const format = await getFormatter();

  return (
    <div className="grid gap-5">
      <Link href="/teacher/classes" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary-edge">
        <ArrowLeft className="size-4" aria-hidden />
        {t("title")}
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold sm:text-3xl">{klass.name}</h1>
          <p className="text-sm font-bold text-muted">
            {klass.school.name} · {t("gradeN", { grade: klass.grade })} · {klass.academicYear}
          </p>
        </div>
        <Link
          href={`/teacher/buildings?class=${klass.id}`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <Landmark aria-hidden />
          {t("buildingSettings")}
        </Link>
        <form action={setClassArchived.bind(null, klass.id, !klass.archivedAt)}>
          <Button type="submit" variant="ghost" size="sm">
            {klass.archivedAt ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
            {klass.archivedAt ? t("restore") : t("archive")}
          </Button>
        </form>
        <ConfirmForm
          action={deleteClass.bind(null, klass.id)}
          variant="danger"
          confirm={t("deleteConfirm", { name: klass.name, count: klass.students.length })}
        >
          <Trash2 aria-hidden />
          {t("delete")}
        </ConfirmForm>
      </div>
      <p className="-mt-3 text-xs text-muted">{t("archiveHint")}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="students-title" className="grid content-start gap-3">
          <h2 id="students-title" className="text-xl font-extrabold">
            {t("studentsTitle", { count: klass.students.length })}
          </h2>
          {klass.students.length === 0 ? (
            <Card tone="flat">
              <p className="text-muted">{t("noStudents")}</p>
            </Card>
          ) : (
            <ul className="grid gap-2.5">
              {klass.students.map((s) => (
                <li key={s.id}>
                  <Card className="grid gap-3 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/teacher/students/${s.id}`} className="text-lg font-extrabold text-fg">
                          {s.lastName} {s.firstName}
                        </Link>
                        <p className="text-sm text-muted">
                          <span className="font-mono">{s.login}</span>
                          {" · "}
                          {s.average != null ? t("average", { score: s.average }) : t("noResults")}
                          {" · "}
                          {t("attempts", { count: s.attempts })}
                          {s.lastActive &&
                            ` · ${t("lastActive", { date: format.dateTime(s.lastActive, { day: "2-digit", month: "2-digit" }) })}`}
                        </p>
                      </div>
                      <div className="flex w-40 items-center gap-2">
                        <Progress value={s.completion} label={t("completion")} className="h-2.5 flex-1" />
                        <span className="text-sm font-extrabold">{s.completion}%</span>
                      </div>
                      <Link
                        href={`/teacher/students/${s.id}`}
                        aria-label={t("open", { name: s.firstName })}
                        className="grid size-9 place-items-center rounded-full hover:bg-cream"
                      >
                        <ChevronRight className="size-5 text-ink-500" aria-hidden />
                      </Link>
                    </div>
                    <StudentActions classId={klass.id} student={s} />
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-4">
          <Card>
            <InviteCard classId={klass.id} code={klass.inviteCode} link={`${env.APP_URL}/join/${klass.inviteCode}`} />
          </Card>
          <Card>
            <AddStudentForm classId={klass.id} />
          </Card>
        </div>
      </div>
    </div>
  );
}
