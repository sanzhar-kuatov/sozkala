import { Search } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { Pager } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { listAudit, listErrors } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("logs") };
}

/** Audit log ("who changed what", spec §11) and the error journal. */
export default async function AdminLogsPage({ searchParams }: PageProps<"/[locale]/admin/logs">) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const tab = one(sp.tab) === "errors" ? "errors" : "audit";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const action = one(sp.action);
  const actor = one(sp.actor);
  const [t, format] = await Promise.all([getTranslations("admin"), getFormatter()]);
  const when = (d: Date) =>
    format.dateTime(d, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  const tabs = (
    <nav aria-label={t("logs.tabs")} className="flex gap-2">
      {(["audit", "errors"] as const).map((k) => (
        <Link
          key={k}
          href={k === "audit" ? "/admin/logs" : "/admin/logs?tab=errors"}
          aria-current={tab === k ? "page" : undefined}
          className={cn(
            "rounded-full border-2 px-3 py-1 text-sm font-extrabold no-underline",
            tab === k ? "border-ink-900 bg-ink-900 text-white" : "border-line bg-surface text-ink-700",
          )}
        >
          {t(`logs.${k}`)}
        </Link>
      ))}
    </nav>
  );

  if (tab === "errors") {
    const { rows, total, pages } = await listErrors(user, page);
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("logs.title")}</h1>
        {tabs}
        <Card className="grid gap-3">
          <p className="text-sm text-muted">{t("logs.errorCount", { count: total })}</p>
          {rows.length === 0 ? (
            <p className="text-sm text-muted">{t("overview.noErrors")}</p>
          ) : (
            <ul className="grid gap-2">
              {rows.map((e) => (
                <li key={e.id}>
                  <details className="rounded-md border border-line bg-surface p-3 text-sm">
                    <summary className="cursor-pointer">
                      <span className="text-xs text-muted tabular-nums">{when(e.createdAt)}</span>{" "}
                      <b className={e.level === "error" ? "text-coral-700" : "text-sun-700"}>{e.level}</b>{" "}
                      <span className="break-words">{e.message}</span>
                    </summary>
                    {e.context && (
                      <pre className="mt-2 overflow-x-auto rounded bg-paper p-2 text-xs">
                        {JSON.stringify(e.context, null, 2)}
                      </pre>
                    )}
                    {e.stack && (
                      <pre className="mt-2 max-h-72 overflow-auto rounded bg-paper p-2 text-xs">{e.stack}</pre>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          )}
          <Pager page={page} pages={pages} href="/admin/logs" query={{ tab: "errors" }} />
        </Card>
      </div>
    );
  }

  const { rows, total, pages } = await listAudit(user, { action, actor, page });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("logs.title")}</h1>
      {tabs}
      <Card className="grid gap-3">
        <form role="search" className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Input
            name="action"
            defaultValue={action}
            placeholder={t("logs.action")}
            aria-label={t("logs.action")}
            className="min-h-10 py-2"
          />
          <Input
            name="actor"
            defaultValue={actor}
            placeholder={t("logs.actor")}
            aria-label={t("logs.actor")}
            className="min-h-10 py-2"
          />
          <Button type="submit" variant="ghost">
            <Search aria-hidden />
            {t("users.find")}
          </Button>
        </form>
        <p className="text-sm text-muted">{t("logs.auditCount", { count: total })}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                {[t("logs.when"), t("logs.actionCol"), t("logs.actorCol"), t("logs.entity"), t("logs.details")].map(
                  (h) => (
                    <th key={h} scope="col" className="border-b border-line px-2 py-2 font-bold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top odd:bg-paper">
                  <td className="px-2 py-1.5 text-xs whitespace-nowrap text-muted tabular-nums">{when(r.createdAt)}</td>
                  <td className="px-2 py-1.5 font-mono text-xs font-bold">{r.action}</td>
                  <td className="px-2 py-1.5 font-mono text-xs">{r.actor?.login ?? "—"}</td>
                  <td className="px-2 py-1.5 text-xs">
                    {r.entity}
                    {r.entityId && <span className="block max-w-48 truncate font-mono text-muted">{r.entityId}</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-xs break-all text-muted">
                    {r.data ? JSON.stringify(r.data).slice(0, 200) : ""}
                    {r.ip && <span className="block">IP {r.ip}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} href="/admin/logs" query={{ action, actor }} />
      </Card>
    </div>
  );
}
