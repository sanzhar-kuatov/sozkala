import { Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Link } from "@/i18n/navigation";
import { listSchools } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import { deleteSchool, saveSchool } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("schools") };
}

/** Schools (spec §2.4). A school can be deleted only while it has no users and no classes. */
export default async function AdminSchoolsPage() {
  const user = await requireRole("ADMIN");
  const [schools, t] = await Promise.all([listSchools(user), getTranslations("admin")]);
  const fields = (s?: { name: string; city: string | null }) => (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <label className="grid gap-1 text-sm font-extrabold">
        {t("schools.name")}
        <Input name="name" required minLength={2} maxLength={120} defaultValue={s?.name} className="min-h-11 py-2" />
      </label>
      <label className="grid gap-1 text-sm font-extrabold">
        {t("schools.city")}
        <Input name="city" maxLength={60} defaultValue={s?.city ?? ""} className="min-h-11 py-2" />
      </label>
    </div>
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("schools.title")}</h1>

      <ul className="grid gap-3">
        {schools.map((s) => (
          <li key={s.id}>
            <Card className="grid gap-3">
              <p className="text-sm text-muted">
                <Link href={`/admin/users?school=${s.id}`} className="font-bold text-primary-edge">
                  {t("schools.users", { count: s._count.users })}
                </Link>{" "}
                · {t("schools.classes", { count: s._count.classes })}
              </p>
              <ActionForm action={saveSchool.bind(null, s.id)} submit={t("save")} size="sm">
                {fields(s)}
              </ActionForm>
              {s._count.users + s._count.classes === 0 && (
                <ActionForm
                  action={deleteSchool.bind(null, s.id)}
                  submit={
                    <>
                      <Trash2 aria-hidden />
                      {t("schools.delete")}
                    </>
                  }
                  variant="ghost"
                  size="sm"
                  confirm={t("schools.deleteConfirm", { name: s.name })}
                />
              )}
            </Card>
          </li>
        ))}
      </ul>

      <Card className="grid gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Plus className="size-5" aria-hidden />
          {t("schools.create")}
        </h2>
        <ActionForm action={saveSchool.bind(null, null)} submit={t("schools.createSubmit")}>
          {fields()}
        </ActionForm>
      </Card>
    </div>
  );
}
