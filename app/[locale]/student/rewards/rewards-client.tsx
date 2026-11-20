"use client";

import { Brain, BrickWall, ShoppingBag, Star, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { CityMap } from "@/components/city/city-map";
import { decorationPreviewSvg } from "@/components/city/engine/decorations";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { RewardsView } from "@/lib/student/rewards";
import { cn } from "@/lib/utils";
import { buyDecoration, placeDecoration, removeDecoration, type ShopResult } from "./actions";

/** Engine-drawn preview, identical to how the decoration looks on the map. */
function DecoPreview({ itemKey, label, className }: { itemKey: string; label: string; className?: string }) {
  return (
    <span
      className={cn("block", className)}
      dangerouslySetInnerHTML={{ __html: decorationPreviewSvg(itemKey, label) }}
    />
  );
}

/** Shop, inventory and placement on the city map (spec §6: tree, flower, road, bench, lamp, fountain). */
export function DecorationsWorkshop({ view }: { view: RewardsView }) {
  const t = useTranslations();
  const locale = useLocale() as "kk" | "ru";
  const [selected, setSelected] = useState<string | null>(null); // inventory item being placed
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<ShopResult | null>(null);
  const [pending, start] = useTransition();
  const name = (key: string) => view.catalog.find((c) => c.key === key)?.name[locale] ?? key;

  const run = (fn: () => Promise<ShopResult>) =>
    start(async () => {
      const res = await fn();
      setMessage(res);
    });

  return (
    <div className="grid gap-4">
      <section aria-labelledby="shop" className="grid gap-3">
        <h2 id="shop" className="text-xl font-extrabold">
          {t("rewards.shop")}
        </h2>
        <p className="text-sm text-muted">{t("rewards.shopHint")}</p>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7">
          {view.catalog.map((d) => {
            const affordable = view.city.materials >= d.cost;
            return (
              <li key={d.key}>
                <Card className="grid justify-items-center gap-1.5 p-3 text-center">
                  <DecoPreview itemKey={d.key} label={d.name[locale]} className="w-20" />
                  <span className="text-sm font-bold">{d.name[locale]}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-coral-700">
                    <BrickWall className="size-3.5" aria-hidden />
                    {d.cost}
                  </span>
                  <Button
                    size="sm"
                    variant={affordable ? "primary" : "ghost"}
                    disabled={!affordable || pending}
                    onClick={() => run(() => buyDecoration(d.key))}
                    aria-label={t("rewards.buyItem", { name: d.name[locale] })}
                  >
                    <ShoppingBag aria-hidden />
                    {t("rewards.buy")}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
        {message && !message.ok && (
          <p role="alert" className="rounded-md bg-coral-100 px-3 py-2 text-sm font-bold text-coral-700">
            {t(`rewards.errors.${message.error}`)}
          </p>
        )}
      </section>

      <section aria-labelledby="place" className="grid gap-3">
        <h2 id="place" className="text-xl font-extrabold">
          {t("rewards.place")}
        </h2>
        {view.inventory.length === 0 ? (
          <p className="text-sm text-muted">{t("rewards.inventoryEmpty")}</p>
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label={t("rewards.inventory")}>
            {view.inventory.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={selected === item.id}
                onClick={() => {
                  setRemoving(false);
                  setSelected(selected === item.id ? null : item.id);
                }}
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border-2 bg-surface px-3 font-bold",
                  selected === item.id ? "border-primary bg-sky-50" : "border-line",
                )}
              >
                <DecoPreview itemKey={item.key} label="" className="w-6" />
                {name(item.key)}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <p role="status" className="min-w-0 flex-1 text-sm font-bold text-primary-edge">
            {selected ? t("rewards.pickSlot") : removing ? t("rewards.pickRemove") : ""}
          </p>
          {view.placed.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setSelected(null);
                setRemoving((r) => !r);
              }}
            >
              {removing ? <X aria-hidden /> : <Trash2 aria-hidden />}
              {removing ? t("rewards.done") : t("rewards.removeMode")}
            </Button>
          )}
        </div>

        <CityMap
          levels={view.levels}
          cityName={view.city.name}
          decorations={view.placed}
          editSlots={!!selected}
          onSlot={(slot) => {
            if (!selected) return;
            const id = selected;
            setSelected(null);
            run(() => placeDecoration(id, slot));
          }}
          onDecoration={(id) => removing && run(() => removeDecoration(id))}
          labels={{
            map: t("city.mapLabel", { name: view.city.name }),
            zoomIn: t("city.zoomIn"),
            zoomOut: t("city.zoomOut"),
            zoomReset: t("city.zoomReset"),
          }}
        />
      </section>
    </div>
  );
}

export function Counters({ points, materials, stars }: { points: number; materials: number; stars: number }) {
  const t = useTranslations("city");
  const items = [
    { icon: Brain, value: points, label: t("points"), tint: "bg-sky-100 text-sky-700" },
    { icon: BrickWall, value: materials, label: t("materials"), tint: "bg-coral-100 text-coral-700" },
    { icon: Star, value: stars, label: t("stars"), tint: "bg-sun-100 text-sun-700" },
  ];
  return (
    <ul className="grid grid-cols-3 gap-3">
      {items.map(({ icon: Icon, value, label, tint }) => (
        <li key={label}>
          <Card className="flex items-center gap-3 p-4">
            <span className={cn("grid size-11 shrink-0 place-items-center rounded-full", tint)}>
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-2xl font-extrabold">{value.toLocaleString("ru-RU")}</span>
              <span className="block truncate text-xs font-bold text-muted">{label}</span>
            </span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
