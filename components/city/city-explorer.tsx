"use client";

import { Brain, BrickWall, Check, ChevronRight, Hourglass, Lock, Pencil, PartyPopper, Star, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { markLevelUpsSeen, renameCity } from "@/app/[locale]/student/actions";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Link } from "@/i18n/navigation";
import { BUILDINGS, type BuildingKey } from "@/lib/domain/buildings";
import { scoreForNextLevel } from "@/lib/domain/levels";
import type { CityView } from "@/lib/student/city";
import { cn } from "@/lib/utils";
import { BUILDING_ICONS, levelColor } from "./building-icon";
import { CityMap } from "./city-map";
import { buildingSvg } from "./engine/buildings";

/** Student home: my city (docs/design/03-ux-wireframes.md §3.1–3.2). */
export function CityExplorer({ view }: { view: CityView }) {
  const t = useTranslations();
  const locale = useLocale() as "kk" | "ru";
  const [selected, setSelected] = useState<BuildingKey | null>(null);
  const [cityName, setCityName] = useState(view.city.name);
  const panelRef = useRef<HTMLDivElement>(null);

  // Play the build animation once for each unseen level-up, one after another.
  const [animIndex, setAnimIndex] = useState(0);
  const current = view.levelUps[animIndex];
  useEffect(() => {
    if (view.levelUps.length === 0) return;
    if (!current) {
      void markLevelUpsSeen(view.levelUps.map((l) => l.id));
      return;
    }
    const timer = setTimeout(() => setAnimIndex((i) => i + 1), 2400);
    return () => clearTimeout(timer);
  }, [current, view.levelUps]);

  const levels = useMemo(() => Object.fromEntries(view.buildings.map((b) => [b.key, b.level])), [view.buildings]);
  const nameOf = (key: BuildingKey) => BUILDINGS.find((b) => b.key === key)!.name[locale];
  const state = selected ? view.buildings.find((b) => b.key === selected)! : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <CityName name={cityName} onRenamed={setCityName} />
        <div className="ml-auto flex flex-wrap gap-2">
          <Counter icon={Brain} value={view.city.points} label={t("city.points")} tint="bg-sky-100 text-sky-700" />
          <Counter
            icon={BrickWall}
            value={view.city.materials}
            label={t("city.materials")}
            tint="bg-coral-100 text-coral-700"
          />
          <Counter icon={Star} value={view.city.stars} label={t("city.stars")} tint="bg-sun-100 text-sun-700" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Progress value={view.completion} label={t("city.completion")} className="flex-1" />
        <span className="shrink-0 font-display text-sm font-extrabold">
          {view.completion}% · {t("city.completion")}
        </span>
      </div>

      {view.completion === 0 && (
        <p className="rounded-md bg-sky-50 px-3 py-2.5 text-sm font-semibold text-sky-700">{t("city.empty")}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <CityMap
          className="lg:self-start"
          levels={levels}
          decorations={view.decorations}
          cityName={cityName}
          animateKey={current?.key ?? null}
          selected={selected}
          onSelect={setSelected}
          labels={{
            map: t("city.mapLabel", { name: cityName }),
            zoomIn: t("city.zoomIn"),
            zoomOut: t("city.zoomOut"),
            zoomReset: t("city.zoomReset"),
          }}
        />

        <Card
          ref={panelRef}
          className="grid scroll-mt-20 content-start gap-3 lg:sticky lg:top-20 lg:self-start"
          aria-live="polite"
        >
          {state ? (
            <BuildingPanel
              state={state}
              name={nameOf(state.key)}
              lockedByName={state.lockedBy && nameOf(state.lockedBy.key)}
              onClose={() => setSelected(null)}
            />
          ) : (
            <p className="text-sm font-bold text-muted">{t("city.selectHint")}</p>
          )}
        </Card>
      </div>

      {/* The same buildings as a list: quick access on phones and for keyboard / screen-reader users. */}
      <section aria-labelledby="buildings-list">
        <h2 id="buildings-list" className="mb-2 text-lg font-bold">
          {t("city.buildingsList")}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {view.buildings.map((b) => {
            const Icon = BUILDING_ICONS[b.key];
            return (
              <li key={b.key}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(b.key);
                    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                  }}
                  aria-pressed={selected === b.key}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-md border border-line bg-surface p-2.5 text-left transition-colors hover:bg-cream",
                    selected === b.key && "border-primary bg-sky-50",
                  )}
                >
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-[10px] text-white"
                    style={{ background: levelColor(b.level) }}
                  >
                    {b.lockedBy ? (
                      <Lock className="size-4" aria-hidden />
                    ) : (
                      <Icon className="size-[18px]" aria-hidden />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{nameOf(b.key)}</span>
                    <span className="block text-xs text-muted">
                      {t(`levels.${b.level as 0 | 1 | 2 | 3 | 4 | 5}`)}
                      {b.tasks.total > 0 && ` · ${b.tasks.done}/${b.tasks.total}`}
                    </span>
                  </span>
                  <LevelBadge level={b.level} />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {current && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg bg-ink-900 px-4 py-3 text-white shadow-float lg:bottom-8"
        >
          <PartyPopper className="size-6 shrink-0 text-sun-500" aria-hidden />
          <span className="font-bold">
            {t("city.levelUp", { building: nameOf(current.key), level: current.level })}
          </span>
        </div>
      )}
    </div>
  );
}

function BuildingPanel({
  state,
  name,
  lockedByName,
  onClose,
}: {
  state: CityView["buildings"][number];
  name: string;
  lockedByName: string | null;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as "kk" | "ru";
  const area = BUILDINGS.find((b) => b.key === state.key)!.area[locale];
  const next = scoreForNextLevel(state.level);
  const preview = useMemo(() => buildingSvg(state.key, state.level, { label: name }), [state.key, state.level, name]);

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold">{name}</h2>
          <p className="text-sm text-muted">{area}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("city.close")}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-500 hover:bg-cream"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="sky-gradient rounded-md" dangerouslySetInnerHTML={{ __html: preview }} />

      <LevelSteps level={state.level} />

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="font-bold text-muted">{t("city.level")}</dt>
        <dd className="font-extrabold">{t(`levels.${state.level as 0 | 1 | 2 | 3 | 4 | 5}`)}</dd>
        <dt className="font-bold text-muted">{t("city.score")}</dt>
        <dd className="font-extrabold">{state.score != null ? `${state.score}/10` : t("city.noScore")}</dd>
        <dt className="font-bold text-muted">{t("building.scoring")}</dt>
        <dd className="font-extrabold">{t(`city.modes.${state.scoringMode}`)}</dd>
        <dt className="font-bold text-muted">{t("city.tasks")}</dt>
        <dd className="font-extrabold">
          {state.tasks.total > 0 ? t("city.tasksDone", { done: state.tasks.done, total: state.tasks.total }) : "—"}
        </dd>
      </dl>

      {state.tasks.pending > 0 && (
        <p className="flex items-center gap-2 text-sm font-bold text-violet-700">
          <Hourglass className="size-4" aria-hidden />
          {t("city.tasksPending", { count: state.tasks.pending })}
        </p>
      )}

      {state.lockedBy ? (
        <p className="flex items-start gap-2 rounded-md bg-ink-100 px-3 py-2.5 text-sm font-semibold text-ink-700">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("city.unlockRule", { building: lockedByName ?? "", level: state.lockedBy.minLevel })}
        </p>
      ) : (
        <>
          <p className="text-sm font-bold text-ink-700">
            {next == null ? t("city.maxLevel") : t("city.next", { score: next })}
          </p>
          <Link href={`/student/building/${state.key}`} className={buttonVariants({ variant: "primary" })}>
            {t("city.open")}
            <ChevronRight aria-hidden />
          </Link>
        </>
      )}
    </>
  );
}

/** L1 ✓ L2 ✓ L3 ● L4 ○ L5 ○ */
export function LevelSteps({ level }: { level: number }) {
  const t = useTranslations("city");
  return (
    <ol className="flex gap-1.5" aria-label={t("levelOf", { level })}>
      {[1, 2, 3, 4, 5].map((l) => (
        <li
          key={l}
          className={cn(
            "grid h-7 flex-1 place-items-center rounded-full text-xs font-extrabold",
            l <= level ? "text-white" : "bg-ink-100 text-ink-500",
          )}
          style={l <= level ? { background: levelColor(l) } : undefined}
        >
          {l < level ? <Check className="size-3.5" aria-hidden /> : `L${l}`}
        </li>
      ))}
    </ol>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full border-2 bg-surface py-0.5 pr-2 pl-0.5 text-xs font-extrabold"
      style={{ borderColor: levelColor(level) }}
    >
      <b
        className="grid size-5 place-items-center rounded-full text-[11px] text-white"
        style={{ background: levelColor(level) }}
      >
        {level}
      </b>
      L{level}
    </span>
  );
}

function Counter({
  icon: Icon,
  value,
  label,
  tint,
}: {
  icon: typeof Brain;
  value: number;
  label: string;
  tint: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pr-3 pl-1.5 font-extrabold"
      title={label}
    >
      <span className={cn("grid size-7 place-items-center rounded-full", tint)}>
        <Icon className="size-4" aria-hidden />
      </span>
      {value.toLocaleString("ru-RU")}
      <span className="sr-only">{label}</span>
    </span>
  );
}

function CityName({ name, onRenamed }: { name: string; onRenamed: (n: string) => void }) {
  const t = useTranslations("city");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (!editing) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <h1 className="truncate text-2xl font-extrabold sm:text-3xl">«{name}»</h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={t("rename")}
          title={t("rename")}
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-500 hover:bg-cream hover:text-fg"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <form
      className="flex flex-wrap items-start gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const value = String(new FormData(e.currentTarget).get("cityName") ?? "");
        start(async () => {
          const res = await renameCity(value);
          if (res.ok) {
            onRenamed(res.name);
            setEditing(false);
            setError(false);
          } else setError(true);
        });
      }}
    >
      <div>
        <Input
          name="cityName"
          defaultValue={name}
          maxLength={40}
          autoFocus
          aria-label={t("nameLabel")}
          aria-invalid={error || undefined}
          className="min-h-10 w-64 py-2"
        />
        {error && <p className="mt-1 text-[13px] font-bold text-coral-700">{t("nameError")}</p>}
      </div>
      <button type="submit" disabled={pending} className={buttonVariants({ size: "sm" })}>
        {t("save")}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className={buttonVariants({ size: "sm", variant: "ghost" })}
      >
        {t("cancel")}
      </button>
    </form>
  );
}
