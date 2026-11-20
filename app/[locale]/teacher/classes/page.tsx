import { Archive, ChevronRight, Users } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { listClasses } from "@/lib/teacher/classes";
import { CreateClassForm } from "./create-class-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("classes") };
}

export default async function ClassesPage() {
  const user = await requireRole("TEACHER");
  const classes = await listClasses(user);
  const t = await getTranslations("teacher.classes");

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        {classes.length === 0 ? (
          <Card tone="flat">
            <p className="text-muted">{t("empty")}</p>
          </Card>
        ) : (
          <ul className="grid content-start gap-2.5">
            {classes.map((c) => (
              <li key={c.id}>
                <Link href={`/teacher/classes/${c.id}`} className="block no-underline">
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-cream">
                    <span className="grid size-12 place-items-center rounded-md bg-[#D6F3E3] font-display text-lg font-extrabold text-[#1D7A48]">
                      {c.grade}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-extrabold text-fg">{c.name}</p>
                      <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-4" aria-hidden />
                          {t("students", { count: c._count.members })}
                        </span>
                        <span>{c.academicYear}</span>
                        <span className="font-mono">{c.inviteCode}</span>
                      </p>
                    </div>
                    {c.archivedAt && (
                      <Chip>
                        <Archive aria-hidden />
                        {t("archived")}
                      </Chip>
                    )}
                    <ChevronRight className="size-5 text-ink-300" aria-hidden />
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Card className="content-start lg:self-start">
          <CreateClassForm />
        </Card>
      </div>
    </div>
  );
}
