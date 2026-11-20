import { ArrowLeft, KeyRound, LogOut, Trash2, Unlink } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { getUserDetail, listSchools } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import { deleteUser, linkChild, resetPassword, signOutEverywhere, unlinkChild, updateUser } from "../../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("users") };
}

const ROLES = ["STUDENT", "TEACHER", "PARENT", "ADMIN"] as const;

/** One account: profile, role, school, active flag, password reset, parent links, sessions. */
export default async function AdminUserPage({ params }: PageProps<"/[locale]/admin/users/[id]">) {
  const { id } = await params;
  const admin = await requireRole("ADMIN");
  const [u, schools, t, format] = await Promise.all([
    getUserDetail(admin, id),
    listSchools(admin),
    getTranslations("admin"),
    getFormatter(),
  ]);
  if (!u) notFound();
  const self = u.id === admin.id;
  const label = "grid gap-1 text-sm font-extrabold";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <div>
        <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm font-bold text-primary-edge">
          <ArrowLeft className="size-4" aria-hidden />
          {t("users.title")}
        </Link>
        <h1 className="text-2xl font-extrabold sm:text-3xl">
          {u.lastName} {u.firstName}
        </h1>
        <p className="text-sm text-muted">
          <span className="font-mono">{u.login}</span> · {t(`roles.${u.role}`)} · {t("users.created")}{" "}
          {format.dateTime(u.createdAt, { day: "2-digit", month: "2-digit", year: "numeric" })}
          {u.memberships.length > 0 && ` · ${u.memberships.map((m) => m.class.name).join(", ")}`}
        </p>
      </div>

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("users.profile")}</h2>
        <ActionForm action={updateUser.bind(null, u.id)} submit={t("save")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className={label}>
              {t("users.lastName")}
              <Input name="lastName" required defaultValue={u.lastName} maxLength={50} className="min-h-11 py-2" />
            </label>
            <label className={label}>
              {t("users.firstName")}
              <Input name="firstName" required defaultValue={u.firstName} maxLength={50} className="min-h-11 py-2" />
            </label>
            <label className={label}>
              {t("users.role")}
              <Select name="role" defaultValue={u.role} className="min-h-11" disabled={self}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`roles.${r}`)}
                  </option>
                ))}
              </Select>
              {/* a disabled select is not submitted */}
              {self && <input type="hidden" name="role" value={u.role} />}
            </label>
            <label className={label}>
              {t("users.school")}
              <Select name="schoolId" defaultValue={u.schoolId ?? ""} className="min-h-11">
                <option value="">—</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </label>
            <label className={label}>
              {t("users.locale")}
              <Select name="locale" defaultValue={u.locale} className="min-h-11">
                <option value="kk">Қазақша</option>
                <option value="ru">Русский</option>
              </Select>
            </label>
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-extrabold">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={u.isActive}
                disabled={self}
                className="size-4 accent-(--color-primary)"
              />
              {t("users.active")}
              {self && <input type="hidden" name="isActive" value="on" />}
            </label>
          </div>
          {u.role === "TEACHER" && u._count.classesTaught > 0 && (
            <p className="text-xs text-muted">{t("users.teacherClasses", { count: u._count.classesTaught })}</p>
          )}
        </ActionForm>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="grid content-start gap-3">
          <h2 className="text-lg font-bold">{t("users.security")}</h2>
          <p className="text-sm text-muted">
            {t("users.sessions", { count: u._count.sessions })}
            {u.lastLoginAt &&
              ` · ${t("users.lastLogin")}: ${format.dateTime(u.lastLoginAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          </p>
          {!self && (
            <ActionForm
              action={resetPassword.bind(null, u.id)}
              submit={
                <>
                  <KeyRound aria-hidden />
                  {t("users.resetPassword")}
                </>
              }
              variant="ghost"
              size="sm"
              confirm={t("users.resetConfirm")}
            />
          )}
          {!self && u._count.sessions > 0 && (
            <form action={signOutEverywhere.bind(null, u.id)} className="flex justify-end">
              <Button type="submit" variant="ghost" size="sm">
                <LogOut aria-hidden />
                {t("users.signOut")}
              </Button>
            </form>
          )}
        </Card>

        {(u.role === "PARENT" || u.role === "STUDENT") && (
          <Card className="grid content-start gap-3">
            <h2 className="text-lg font-bold">{u.role === "PARENT" ? t("users.children") : t("users.parents")}</h2>
            <ul className="grid gap-2 text-sm">
              {u.role === "PARENT" &&
                u.childLinks.map(({ student: s }) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <Link href={`/admin/users/${s.id}`} className="min-w-0 flex-1 font-bold text-fg">
                      {s.lastName} {s.firstName} <span className="font-mono text-muted">({s.login})</span>
                    </Link>
                    <form action={unlinkChild.bind(null, u.id, s.id)}>
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        aria-label={t("users.unlink", { name: s.firstName })}
                      >
                        <Unlink aria-hidden />
                      </Button>
                    </form>
                  </li>
                ))}
              {u.role === "STUDENT" &&
                u.parentLinks.map(({ parent: p }) => (
                  <li key={p.id}>
                    <Link href={`/admin/users/${p.id}`} className="font-bold text-fg">
                      {p.lastName} {p.firstName} <span className="font-mono text-muted">({p.login})</span>
                    </Link>
                  </li>
                ))}
              {(u.role === "PARENT" ? u.childLinks : u.parentLinks).length === 0 && (
                <li className="text-muted">{t("users.noLinks")}</li>
              )}
            </ul>
            {u.role === "PARENT" && (
              <ActionForm action={linkChild.bind(null, u.id)} submit={t("users.link")} size="sm" variant="ghost">
                <label className={label}>
                  {t("users.studentLogin")}
                  <Input name="studentLogin" required maxLength={32} className="min-h-10 py-2" />
                </label>
              </ActionForm>
            )}
          </Card>
        )}
      </div>
      {!self && (
        <Card className="border-coral-300 grid gap-2">
          <h2 className="text-lg font-bold text-coral-700">{t("users.delete")}</h2>
          <p className="text-sm text-muted">{t("users.deleteHint")}</p>
          <ActionForm
            action={deleteUser.bind(null, u.id)}
            submit={
              <>
                <Trash2 aria-hidden />
                {t("users.delete")}
              </>
            }
            variant="danger"
            size="sm"
            confirm={t("users.deleteConfirm", { name: `${u.firstName} ${u.lastName}` })}
          />
        </Card>
      )}
    </div>
  );
}
