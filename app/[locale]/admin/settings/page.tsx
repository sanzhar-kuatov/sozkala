import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { requireRole } from "@/lib/auth/guards";
import { getSettings } from "@/lib/settings";
import { saveSettingsAction } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("settings") };
}

/** Platform settings (spec §2.4). Each one is enforced by the app — see lib/settings.ts. */
export default async function AdminSettingsPage() {
  await requireRole("ADMIN");
  const [s, t, tc] = await Promise.all([getSettings(), getTranslations("admin"), getTranslations("city")]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("settings.title")}</h1>
      <Card className="grid gap-3">
        <ActionForm action={saveSettingsAction} submit={t("save")}>
          <div className="grid gap-5">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="registration"
                defaultChecked={s["registration.studentsByInviteCode"]}
                className="mt-1 size-4 accent-(--color-primary)"
              />
              <span>
                <b className="block">{t("settings.registration")}</b>
                <small className="text-muted">{t("settings.registrationHint")}</small>
              </span>
            </label>
            <label className="grid max-w-md gap-1">
              <b>{t("settings.defaultMode")}</b>
              <Select name="defaultMode" defaultValue={s["scoring.defaultMode"]} className="min-h-11">
                {(["BEST", "AVERAGE", "REQUIRED_ONLY"] as const).map((m) => (
                  <option key={m} value={m}>
                    {tc(`modes.${m}`)}
                  </option>
                ))}
              </Select>
              <small className="text-muted">{t("settings.defaultModeHint")}</small>
            </label>
            <label className="grid max-w-md gap-1">
              <b>{t("settings.maxLoginFailures")}</b>
              <Input
                type="number"
                name="maxLoginFailures"
                min={3}
                max={20}
                required
                defaultValue={s["auth.maxLoginFailures"]}
                className="min-h-11 max-w-32 py-2"
              />
              <small className="text-muted">{t("settings.maxLoginFailuresHint")}</small>
            </label>
          </div>
        </ActionForm>
      </Card>
      <p className="text-sm text-muted">{t("settings.emailLater")}</p>
    </div>
  );
}
