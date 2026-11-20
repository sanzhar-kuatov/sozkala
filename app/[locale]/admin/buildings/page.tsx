import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ActionForm } from "@/components/admin/action-form";
import { BUILDING_ICONS } from "@/components/city/building-icon";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { getCatalogue } from "@/lib/admin/queries";
import { requireRole } from "@/lib/auth/guards";
import type { BuildingKey } from "@/lib/domain/buildings";
import { LEVEL_THRESHOLDS } from "@/lib/domain/levels";
import { saveAchievement, saveCoreBuildings, saveDecoration } from "../actions";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.admin");
  return { title: t("buildings") };
}

/**
 * Catalogue (spec §2.4: buildings, decoration levels, rewards). Building names and
 * art are drawn by code (one SVG per building and level), so here the admin
 * chooses which buildings are "main" for the certificate; badges and
 * decorations are fully editable.
 */
export default async function AdminCataloguePage() {
  const user = await requireRole("ADMIN");
  const [{ buildings, achievements, decorations }, t, tl, locale] = await Promise.all([
    getCatalogue(user),
    getTranslations("admin"),
    getTranslations("levels"),
    getLocale(),
  ]);
  const label = "grid gap-1 text-xs font-bold text-muted";
  const input = "min-h-10 py-2 text-sm";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("catalogue.title")}</h1>

      <Card className="grid gap-3">
        <div>
          <h2 className="text-lg font-bold">{t("catalogue.buildings")}</h2>
          <p className="text-sm text-muted">{t("catalogue.buildingsHint")}</p>
        </div>
        <ActionForm action={saveCoreBuildings} submit={t("save")}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {buildings.map((b) => {
              const Icon = BUILDING_ICONS[b.key as BuildingKey];
              return (
                <li key={b.id}>
                  <label className="flex items-center gap-3 rounded-md border border-line bg-surface p-3 text-sm font-bold">
                    <input
                      type="checkbox"
                      name={`core_${b.key}`}
                      defaultChecked={b.isCore}
                      className="size-4 accent-(--color-primary)"
                    />
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-700">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      {locale === "ru" ? b.nameRu : b.nameKk}
                      <small className="block font-semibold text-muted">{t("catalogue.core")}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </ActionForm>
        <div className="grid gap-2 border-t border-line pt-3">
          <h3 className="text-sm font-bold">{t("catalogue.levels")}</h3>
          <ul className="flex flex-wrap gap-2 text-sm">
            {([1, 2, 3, 4, 5] as const).map((l) => (
              <li key={l} className="rounded-full border border-line px-3 py-1">
                <b>L{l}</b> {tl(String(l) as "1")} · {t("catalogue.from", { score: LEVEL_THRESHOLDS[l] })}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted">{t("catalogue.levelsHint")}</p>
        </div>
      </Card>

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("catalogue.badges")}</h2>
        <ul className="grid gap-2">
          {achievements.map((a) => (
            <li key={a.id}>
              <details className="rounded-md border border-line bg-surface p-3">
                <summary className="cursor-pointer font-bold">
                  {locale === "ru" ? a.nameRu : a.nameKk}{" "}
                  <code className="block text-xs font-semibold break-all text-muted">{JSON.stringify(a.rule)}</code>
                </summary>
                <ActionForm action={saveAchievement.bind(null, a.id)} submit={t("save")} size="sm" className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className={label}>
                      {t("catalogue.nameKk")}
                      <Input name="nameKk" required maxLength={200} defaultValue={a.nameKk} className={input} />
                    </label>
                    <label className={label}>
                      {t("catalogue.nameRu")}
                      <Input name="nameRu" required maxLength={200} defaultValue={a.nameRu} className={input} />
                    </label>
                    <label className={label}>
                      {t("catalogue.descriptionKk")}
                      <Input
                        name="descriptionKk"
                        required
                        maxLength={200}
                        defaultValue={a.descriptionKk}
                        className={input}
                      />
                    </label>
                    <label className={label}>
                      {t("catalogue.descriptionRu")}
                      <Input
                        name="descriptionRu"
                        required
                        maxLength={200}
                        defaultValue={a.descriptionRu}
                        className={input}
                      />
                    </label>
                  </div>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{t("catalogue.badgesHint")}</p>
      </Card>

      <Card className="grid gap-3">
        <h2 className="text-lg font-bold">{t("catalogue.decorations")}</h2>
        <ul className="grid gap-2">
          {decorations.map((d) => (
            <li key={d.id} className="rounded-md border border-line bg-surface p-3">
              <ActionForm action={saveDecoration.bind(null, d.id)} submit={t("save")} size="sm">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_140px]">
                  <label className={label}>
                    {t("catalogue.nameKk")}
                    <Input name="nameKk" required maxLength={200} defaultValue={d.nameKk} className={input} />
                  </label>
                  <label className={label}>
                    {t("catalogue.nameRu")}
                    <Input name="nameRu" required maxLength={200} defaultValue={d.nameRu} className={input} />
                  </label>
                  <label className={label}>
                    {t("catalogue.cost")}
                    <Input
                      name="costMaterials"
                      type="number"
                      min={0}
                      max={1000}
                      required
                      defaultValue={d.costMaterials}
                      className={input}
                    />
                  </label>
                </div>
              </ActionForm>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
