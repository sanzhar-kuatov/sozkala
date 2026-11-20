import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BadgeMedal } from "@/components/rewards/badge";
import { Card } from "@/components/ui/card";
import { requireRole } from "@/lib/auth/guards";
import { getRewardsView } from "@/lib/student/rewards";
import { cn } from "@/lib/utils";
import { Counters, DecorationsWorkshop } from "./rewards-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.student");
  return { title: t("rewards") };
}

/** Rewards (wireframe §3.6): counters, badges, decorations shop + placement, history. */
export default async function RewardsPage() {
  const user = await requireRole("STUDENT");
  const view = await getRewardsView(user, user.id);
  if (!view) notFound();
  const t = await getTranslations("rewards");
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";
  const earnedCount = view.achievements.filter((a) => a.earnedAt).length;

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
      <Counters points={view.city.points} materials={view.city.materials} stars={view.city.stars} />

      <section aria-labelledby="badges" className="grid gap-3">
        <h2 id="badges" className="text-xl font-extrabold">
          {t("badges", { earned: earnedCount, total: view.achievements.length })}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {view.achievements.map((a) => (
            <li key={a.key}>
              <Card
                className={cn("grid h-full justify-items-center gap-2 p-4 text-center", !a.earnedAt && "opacity-70")}
              >
                <BadgeMedal icon={a.icon} color={a.color} locked={!a.earnedAt} />
                <span className="font-bold">{a.name[locale]}</span>
                <span className="text-xs text-muted">{a.description[locale]}</span>
                <span className={cn("text-xs font-extrabold", a.earnedAt ? "text-grass-700" : "text-ink-500")}>
                  {a.earnedAt
                    ? t("earnedOn", { date: format.dateTime(a.earnedAt, { day: "2-digit", month: "2-digit" }) })
                    : t("locked")}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <DecorationsWorkshop view={view} />

      <section aria-labelledby="history" className="grid gap-2">
        <h2 id="history" className="text-xl font-extrabold">
          {t("history")}
        </h2>
        {view.ledger.length === 0 ? (
          <p className="text-sm text-muted">{t("historyEmpty")}</p>
        ) : (
          <ul className="grid gap-1 text-sm">
            {view.ledger.map((l) => (
              <li key={l.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2">
                <span
                  className={cn("w-16 font-display font-extrabold", l.amount > 0 ? "text-grass-700" : "text-coral-700")}
                >
                  {l.amount > 0 ? "+" : ""}
                  {l.amount}
                </span>
                <span className="font-bold">{t(`kinds.${l.kind}`)}</span>
                <span className="min-w-0 flex-1 truncate text-muted">
                  {l.task ?? t(`reasons.${reasonKey(l.reason)}`)}
                </span>
                <span className="text-xs text-muted">
                  {format.dateTime(l.createdAt, { day: "2-digit", month: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const REASONS = ["attempt_graded", "building_level_up", "attempt_excellent", "decoration_buy"] as const;
function reasonKey(reason: string): (typeof REASONS)[number] {
  const k = reason.replace(".", "_");
  return (REASONS as readonly string[]).includes(k) ? (k as (typeof REASONS)[number]) : "attempt_graded";
}
