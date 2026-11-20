"use client";

import { Check, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { BUILDING_ICONS } from "@/components/city/building-icon";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { saveBuildingConfig, type ConfigResult } from "./actions";

export type ConfigRow = {
  key: BuildingKey;
  order: number;
  required: boolean;
  mode: "BEST" | "AVERAGE" | "REQUIRED_ONLY";
  after: BuildingKey | "";
  minLevel: number;
};

export function ConfigForm({ classId, rows }: { classId: string; rows: ConfigRow[] }) {
  const t = useTranslations();
  const locale = useLocale() as "kk" | "ru";
  const [state, action, pending] = useActionState<ConfigResult, FormData>(
    saveBuildingConfig.bind(null, classId),
    undefined,
  );
  const name = (key: string) => BUILDINGS.find((b) => b.key === key)!.name[locale];
  const sorted = [...rows].sort((a, b) => a.order - b.order);

  return (
    <form action={action} className="grid gap-3">
      <ul className="grid gap-2.5">
        {sorted.map((r) => {
          const Icon = BUILDING_ICONS[r.key];
          return (
            <li
              key={r.key}
              className="grid gap-3 rounded-lg border border-line bg-surface p-4 lg:grid-cols-[minmax(0,1.3fr)_90px_minmax(0,1fr)_minmax(0,1.4fr)]"
            >
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-md bg-sky-100 text-sky-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">{name(r.key)}</p>
                  <label className="inline-flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      name={`required_${r.key}`}
                      defaultChecked={r.required}
                      className="size-4 accent-(--color-primary)"
                    />
                    {t("teacher.buildings.required")}
                  </label>
                </div>
              </div>
              <label className="grid gap-1 text-xs font-bold text-muted">
                {t("teacher.buildings.order")}
                <Select name={`order_${r.key}`} defaultValue={r.order} className="min-h-10">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
              </label>
              <label className="grid gap-1 text-xs font-bold text-muted">
                {t("teacher.buildings.mode")}
                <Select name={`mode_${r.key}`} defaultValue={r.mode} className="min-h-10">
                  {(["BEST", "AVERAGE", "REQUIRED_ONLY"] as const).map((m) => (
                    <option key={m} value={m}>
                      {t(`city.modes.${m}`)}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="grid grid-cols-[minmax(0,1fr)_80px] gap-2">
                <label className="grid gap-1 text-xs font-bold text-muted">
                  {t("teacher.buildings.unlock")}
                  <Select name={`after_${r.key}`} defaultValue={r.after} className="min-h-10">
                    <option value="">{t("teacher.buildings.always")}</option>
                    {BUILDINGS.filter((b) => b.key !== r.key).map((b) => (
                      <option key={b.key} value={b.key}>
                        {t("teacher.buildings.after", { building: b.name[locale] })}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="grid gap-1 text-xs font-bold text-muted">
                  {t("teacher.buildings.minLevel")}
                  <Select name={`min_${r.key}`} defaultValue={r.minLevel} className="min-h-10">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        L{n}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </li>
          );
        })}
      </ul>
      {state?.error && (
        <p role="alert" className="rounded-md bg-coral-100 px-3 py-2.5 text-sm font-bold text-coral-700">
          {t(`teacher.buildings.errors.${state.error}`)}
        </p>
      )}
      <div className="flex items-center justify-end gap-3">
        {state?.ok && !pending && (
          <span role="status" className="inline-flex items-center gap-1.5 text-sm font-bold text-grass-700">
            <Check className="size-4" aria-hidden />
            {t("teacher.saved")}
          </span>
        )}
        <Button type="submit" disabled={pending}>
          <Save aria-hidden />
          {t("teacher.save")}
        </Button>
      </div>
    </form>
  );
}
