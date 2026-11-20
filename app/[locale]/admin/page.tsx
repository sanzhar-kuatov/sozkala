import { DatabaseBackup, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { getOverview } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("overview") };
}

/** Platform health at a glance (wireframe §6). */
export default async function AdminOverviewPage() {
  const user = await requireRole("ADMIN");
  const [o, t, format] = await Promise.all([getOverview(user), getTranslations("admin"), getFormatter()]);
  const when = (d: Date) =>
    format.dateTime(d, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  const tiles = [
    { label: t("roles.STUDENT"), value: o.users.STUDENT, href: "/admin/users?role=STUDENT" },
    { label: t("roles.TEACHER"), value: o.users.TEACHER, href: "/admin/users?role=TEACHER" },
    { label: t("roles.PARENT"), value: o.users.PARENT, href: "/admin/users?role=PARENT" },
    { label: t("overview.schools"), value: o.schools, href: "/admin/schools" },
    { label: t("overview.classes"), value: o.classes },
    { label: t("overview.tasks"), value: o.tasks },
    { label: t("overview.attempts"), value: o.attempts },
    { label: t("overview.certificates"), value: o.certificates, href: "/admin/certificates" },
  ];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("overview.title")}</h1>

      <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Card className="p-4">
              <span className="block font-display text-3xl font-extrabold">{tile.value}</span>
              {tile.href ? (
                <Link href={tile.href} className="text-sm font-bold text-primary-edge">
                  {tile.label}
                </Link>
              ) : (
                <span className="block text-sm font-bold text-muted">{tile.label}</span>
              )}
            </Card>
          </li>
        ))}
      </ul>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <TriangleAlert className="size-5 text-coral-700" aria-hidden />
            {t("overview.errors", { count: o.errors24h })}
          </h2>
          {o.recentErrors.length === 0 ? (
            <p className="text-sm text-muted">{t("overview.noErrors")}</p>
          ) : (
            <ul className="grid gap-1.5 text-sm">
              {o.recentErrors.map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="shrink-0 text-xs text-muted tabular-nums">{when(e.createdAt)}</span>
                  <span className="min-w-0 truncate">{e.message}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/admin/logs?tab=errors" className="text-sm font-bold text-primary-edge">
            {t("overview.allErrors")}
          </Link>
        </Card>

        <Card className="grid content-start gap-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <DatabaseBackup className="size-5 text-sky-700" aria-hidden />
            {t("overview.backup")}
          </h2>
          <p className="text-sm">
            {o.lastBackup ? t("overview.lastBackup", { when: when(o.lastBackup.createdAt) }) : t("overview.noBackup")}
          </p>
          <Link href="/admin/backups" className="text-sm font-bold text-primary-edge">
            {t("overview.manageBackups")}
          </Link>
        </Card>
      </div>

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("overview.recentAudit")}</h2>
        <ul className="grid gap-1.5 text-sm">
          {o.recentAudit.map((a) => (
            <li key={a.id} className="flex flex-wrap gap-x-3">
              <span className="text-xs text-muted tabular-nums">{when(a.createdAt)}</span>
              <code className="font-bold">{a.action}</code>
              <span className="text-muted">{a.actor?.login ?? "—"}</span>
            </li>
          ))}
        </ul>
        <Link href="/admin/logs" className="text-sm font-bold text-primary-edge">
          {t("overview.allAudit")}
        </Link>
      </Card>
    </div>
  );
}
