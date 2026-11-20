import { DatabaseBackup, Download, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { Card } from "@/components/ui/card";
import { backupsSupported, listBackups } from "@/lib/admin/backups";
import { assertAdmin } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import { createBackupAction, deleteBackupAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("backups") };
}

/** Backups of the SQLite database (spec §2.4, §11): create now, download, delete. */
export default async function AdminBackupsPage() {
  const user = await requireRole("ADMIN");
  assertAdmin(user);
  const [backups, t, format] = await Promise.all([listBackups(), getTranslations("admin"), getFormatter()]);
  const size = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("backups.title")}</h1>
      {!backupsSupported() ? (
        <Card tone="tint" className="grid gap-1">
          <p className="font-bold">{t("backups.remoteTitle")}</p>
          <p className="text-sm text-muted">{t("backups.remoteBody")}</p>
        </Card>
      ) : (
        <>
          <Card className="grid gap-3">
            <p className="text-sm text-muted">{t("backups.hint")}</p>
            <ActionForm
              action={createBackupAction}
              submit={
                <>
                  <DatabaseBackup aria-hidden />
                  {t("backups.create")}
                </>
              }
            />
          </Card>
        </>
      )}

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("backups.list")}</h2>
        {backups.length === 0 ? (
          <p className="text-sm text-muted">{t("backups.none")}</p>
        ) : (
          <ul className="grid gap-2">
            {backups.map((b) => (
              <li
                key={b.name}
                className="grid items-center gap-2 rounded-md border border-line bg-surface p-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-mono font-bold">{b.name}</span>
                  <small className="text-muted">
                    {format.dateTime(b.createdAt, {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}{" "}
                    · {size(b.size)}
                  </small>
                </span>
                <a
                  href={`/api/admin/backups/${b.name}`}
                  download
                  className="inline-flex items-center gap-1 font-bold text-primary-edge"
                >
                  <Download className="size-4" aria-hidden />
                  {t("backups.download")}
                </a>
                <ActionForm
                  action={deleteBackupAction.bind(null, b.name)}
                  submit={
                    <>
                      <Trash2 aria-hidden />
                      {t("backups.delete")}
                    </>
                  }
                  variant="ghost"
                  size="sm"
                  confirm={t("backups.deleteConfirm", { name: b.name })}
                />
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">{t("backups.restore")}</p>
      </Card>
    </div>
  );
}
