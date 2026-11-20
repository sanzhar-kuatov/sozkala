import { Search, UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { Pager } from "@/components/admin/pager";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { isRole, listSchools, listUsers } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import { createUser } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("users") };
}

const ROLES = ["STUDENT", "TEACHER", "PARENT", "ADMIN"] as const;

/** Users and roles (spec §2.4, wireframe §6). */
export default async function AdminUsersPage({ searchParams }: PageProps<"/[locale]/admin/users">) {
  const user = await requireRole("ADMIN");
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q);
  const role = isRole(one(sp.role)) ? (one(sp.role) as (typeof ROLES)[number]) : undefined;
  const schoolId = one(sp.school) || undefined;
  const page = Math.max(1, Number(one(sp.page)) || 1);

  const [{ rows, total, pages }, schools, t, format] = await Promise.all([
    listUsers(user, { q, role, schoolId, page }),
    listSchools(user),
    getTranslations("admin"),
    getFormatter(),
  ]);
  const query = { q, role: role ?? "", school: schoolId ?? "" };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("users.title")}</h1>

      <Card className="grid gap-3">
        <form className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px_220px_auto]" role="search">
          <Input
            name="q"
            defaultValue={q}
            placeholder={t("users.search")}
            aria-label={t("users.search")}
            className="min-h-11 py-2"
          />
          <Select name="role" defaultValue={role ?? ""} aria-label={t("users.role")} className="min-h-11">
            <option value="">{t("users.allRoles")}</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </Select>
          <Select name="school" defaultValue={schoolId ?? ""} aria-label={t("users.school")} className="min-h-11">
            <option value="">{t("users.allSchools")}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="ghost">
            <Search aria-hidden />
            {t("users.find")}
          </Button>
        </form>
        <p className="text-sm text-muted">{t("users.found", { count: total })}</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs text-muted">
                {[t("users.name"), t("users.login"), t("users.role"), t("users.school"), t("users.lastLogin"), ""].map(
                  (h, i) => (
                    <th key={i} scope="col" className="border-b border-line px-2 py-2 font-bold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="odd:bg-paper">
                  <td className="px-2 py-2">
                    <Link href={`/admin/users/${u.id}`} className="font-bold text-fg">
                      {u.lastName} {u.firstName}
                    </Link>
                  </td>
                  <td className="px-2 py-2 font-mono">{u.login}</td>
                  <td className="px-2 py-2">{t(`roles.${u.role}`)}</td>
                  <td className="px-2 py-2 text-muted">{u.school?.name ?? "—"}</td>
                  <td className="px-2 py-2 text-muted tabular-nums">
                    {u.lastLoginAt
                      ? format.dateTime(u.lastLoginAt, { day: "2-digit", month: "2-digit", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-2 py-2">{!u.isActive && <Chip tone="warning">{t("users.inactive")}</Chip>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager page={page} pages={pages} href="/admin/users" query={query} />
      </Card>

      <Card className="grid gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <UserPlus className="size-5" aria-hidden />
          {t("users.create")}
        </h2>
        <ActionForm action={createUser} submit={t("users.createSubmit")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="grid gap-1 text-sm font-extrabold">
              {t("users.role")}
              <Select name="role" defaultValue="TEACHER" className="min-h-11">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-1 text-sm font-extrabold">
              {t("users.lastName")}
              <Input name="lastName" required maxLength={50} className="min-h-11 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-extrabold">
              {t("users.firstName")}
              <Input name="firstName" required maxLength={50} className="min-h-11 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-extrabold">
              {t("users.loginOptional")}
              <Input name="login" maxLength={32} pattern="[a-zA-Z0-9._\-]{3,32}" className="min-h-11 py-2" />
            </label>
            <label className="grid gap-1 text-sm font-extrabold">
              {t("users.school")}
              <Select name="schoolId" defaultValue={schools[0]?.id ?? ""} className="min-h-11">
                <option value="">—</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
