import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { listClasses } from "@/lib/teacher/classes";
import { cn } from "@/lib/utils";
import { ConfigForm, type ConfigRow } from "./config-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.teacher");
  return { title: t("buildings") };
}

/** Per-class building settings (wireframe §4.3). */
export default async function BuildingsConfigPage({ searchParams }: PageProps<"/[locale]/teacher/buildings">) {
  const user = await requireRole("TEACHER");
  const t = await getTranslations("teacher.buildings");
  const classes = (await listClasses(user)).filter((c) => !c.archivedAt);
  const wanted = (await searchParams).class;
  const klass = classes.find((c) => c.id === wanted) ?? classes[0];

  if (!klass) {
    return (
      <div className="grid gap-4">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <Card tone="flat">
          <p className="text-muted">{t("noClasses")}</p>
        </Card>
      </div>
    );
  }

  const configs = await db.classBuildingConfig.findMany({
    where: { classId: klass.id },
    select: {
      unlockOrder: true,
      isRequired: true,
      scoringMode: true,
      unlockMinLevel: true,
      building: { select: { key: true } },
      unlockAfter: { select: { key: true } },
    },
  });
  const rows: ConfigRow[] = BUILDINGS.map((b, i) => {
    const c = configs.find((x) => x.building.key === b.key);
    return {
      key: b.key,
      order: c?.unlockOrder ?? i + 1,
      required: c?.isRequired ?? true,
      mode: c?.scoringMode ?? "BEST",
      after: (c?.unlockAfter?.key as BuildingKey | undefined) ?? "",
      minLevel: c?.unlockMinLevel ?? 2,
    };
  });

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">{t("intro")}</p>
      </div>
      {classes.length > 1 && (
        <nav aria-label={t("classPicker")} className="flex flex-wrap gap-2">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/buildings?class=${c.id}`}
              aria-current={c.id === klass.id ? "page" : undefined}
              className={cn(
                "rounded-full border-2 px-4 py-1.5 text-sm font-extrabold",
                c.id === klass.id ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-700",
              )}
            >
              {c.name}
            </Link>
          ))}
        </nav>
      )}
      <ConfigForm key={klass.id} classId={klass.id} rows={rows} />
    </div>
  );
}
