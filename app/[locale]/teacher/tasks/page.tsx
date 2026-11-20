import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { BUILDING_ICONS } from "@/components/city/building-icon";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { listTasks } from "@/lib/teacher/tasks";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("tasks") };
}

const STATUS_TONE = { DRAFT: "warning", PUBLISHED: "auto", ARCHIVED: "neutral" } as const;

/** Task bank with filters (wireframe §4, spec §2.2). */
export default async function TasksPage({ searchParams }: PageProps<"/[locale]/teacher/tasks">) {
  const user = await requireRole("TEACHER");
  const sp = await searchParams;
  const filter = {
    building: typeof sp.building === "string" ? sp.building : undefined,
    status: typeof sp.status === "string" ? sp.status : undefined,
    q: typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined,
  };
  const tasks = await listTasks(user, filter);
  const t = await getTranslations("teacher.tasks");
  const tt = await getTranslations("teacher.types");
  const locale = (await getLocale()) as "kk" | "ru";

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <Link href="/teacher/tasks/new" className={buttonVariants({ variant: "accent" })}>
          <Plus aria-hidden />
          {t("new")}
        </Link>
      </div>

      {/* GET form: filters live in the URL, so they survive reloads and can be shared */}
      <form className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
        <input
          name="q"
          defaultValue={filter.q}
          placeholder={t("search")}
          aria-label={t("search")}
          className="min-h-12 rounded-md border-2 border-ink-100 bg-surface px-3.5 font-semibold focus:border-primary focus:outline-none"
        />
        <Select name="building" defaultValue={filter.building ?? ""} aria-label={t("building")}>
          <option value="">{t("allBuildings")}</option>
          {BUILDINGS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name[locale]}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={filter.status ?? ""} aria-label={t("status")}>
          <option value="">{t("active")}</option>
          <option value="DRAFT">{t("statuses.DRAFT")}</option>
          <option value="PUBLISHED">{t("statuses.PUBLISHED")}</option>
          <option value="ARCHIVED">{t("statuses.ARCHIVED")}</option>
        </Select>
        <button type="submit" className={buttonVariants({ variant: "ghost" })}>
          {t("filter")}
        </button>
      </form>

      {tasks.length === 0 ? (
        <Card tone="flat">
          <p className="text-muted">{t("empty")}</p>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {tasks.map((task) => {
            const Icon = BUILDING_ICONS[task.building.key as BuildingKey];
            return (
              <li key={task.id}>
                <Link href={`/teacher/tasks/${task.id}`} className="block no-underline">
                  <Card className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-cream">
                    <span
                      className="grid size-10 place-items-center rounded-md bg-sky-100 text-sky-700"
                      title={BUILDINGS.find((b) => b.key === task.building.key)?.name[locale]}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-fg">{task.title}</p>
                      <p className="text-sm text-muted">
                        {tt(task.type)}
                        {task.topic && ` · ${task.topic.title}`} · {"★".repeat(task.difficulty)}
                        {` · ${t("assigned", { count: task._count.assignments })} · ${t("submissions", { count: task._count.attempts })}`}
                      </p>
                    </div>
                    <Chip tone={STATUS_TONE[task.status]}>{t(`statuses.${task.status}`)}</Chip>
                    <ChevronRight className="size-5 text-ink-300" aria-hidden />
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
