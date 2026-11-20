import {
  Award,
  Bell,
  Building2,
  CalendarCheck,
  ChartColumn,
  CircleCheck,
  ClipboardCheck,
  Flag,
  Medal,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import type { NotificationType } from "@/generated/prisma/enums";
import { Link } from "@/i18n/navigation";
import type { SessionUser } from "@/lib/auth/session";
import { BUILDINGS } from "@/lib/domain/buildings";
import { achievementNames, type FeedItem } from "@/lib/notifications-feed";
import { cn } from "@/lib/utils";
import { MarkReadOnView } from "./mark-read";

const ICON: Record<NotificationType, [LucideIcon, string]> = {
  NEW_BUILDING: [Building2, "bg-sky-100 text-sky-700"],
  DAILY_SUMMARY: [CalendarCheck, "bg-grass-100 text-grass-700"],
  TOPIC_RESULT: [ChartColumn, "bg-violet-100 text-violet-700"],
  COMPLETION_REMAINING: [Flag, "bg-sun-100 text-sun-700"],
  CERTIFICATE_ISSUED: [Award, "bg-sun-100 text-sun-700"],
  LEVEL_UP: [Sparkles, "bg-sky-100 text-sky-700"],
  WORK_GRADED: [CircleCheck, "bg-grass-100 text-grass-700"],
  WORK_RETURNED: [RotateCcw, "bg-coral-100 text-coral-700"],
  REVIEW_NEEDED: [ClipboardCheck, "bg-violet-100 text-violet-700"],
  ACHIEVEMENT_EARNED: [Medal, "bg-violet-100 text-violet-700"],
};

/** Where a notification leads, per role. */
function hrefFor(user: SessionUser, n: FeedItem): string | null {
  const p = n.payload as { attemptId?: string; taskId?: string };
  if (user.role === "PARENT" && n.subject) return `/parent/child/${n.subject.id}`;
  switch (n.type) {
    case "WORK_GRADED":
    case "WORK_RETURNED":
      return p.taskId && p.attemptId ? `/student/task/${p.taskId}/result/${p.attemptId}` : null;
    case "ACHIEVEMENT_EARNED":
      return "/student/rewards";
    case "CERTIFICATE_ISSUED":
      return user.role === "STUDENT" ? "/student/certificate" : null;
    case "REVIEW_NEEDED":
      return p.attemptId ? `/teacher/review/${p.attemptId}` : "/teacher/review";
    default:
      return null;
  }
}

/** Notification feed shared by all cabinets (spec §8). */
export async function NotificationList({ user, items }: { user: SessionUser; items: FeedItem[] }) {
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const locale = (await getLocale()) as "kk" | "ru";
  const badges = items.some((i) => i.type === "ACHIEVEMENT_EARNED") ? await achievementNames() : {};
  const buildingName = (key: unknown) => BUILDINGS.find((b) => b.key === key)?.name[locale] ?? String(key ?? "");

  if (items.length === 0) {
    return (
      <div className="grid justify-items-center gap-2 rounded-lg border border-dashed border-line py-10 text-center">
        <Bell className="size-8 text-ink-300" aria-hidden />
        <p className="font-bold text-muted">{t("empty")}</p>
      </div>
    );
  }

  return (
    <>
      <MarkReadOnView ids={items.filter((i) => !i.read).map((i) => i.id)} />
      <ul className="grid gap-2">
        {items.map((n) => {
          const [Icon, tint] = ICON[n.type];
          const p = n.payload;
          const child = n.subject ? `${n.subject.firstName} ${n.subject.lastName}` : "";
          const values = {
            child,
            student: child,
            building: buildingName(p.building),
            level: Number(p.level ?? 0),
            topic: String(p.topic ?? ""),
            score: Number(p.score ?? 0),
            count: Number(p.count ?? 0),
            percent: Number(p.percent ?? 0),
            name: (badges[String(p.achievement)] ?? { kk: "", ru: "" })[locale],
          };
          const href = hrefFor(user, n);
          // The student's own copy has no subject: "you got a certificate", not "your child got…"
          const key = n.type === "CERTIFICATE_ISSUED" && !n.subject ? "CERTIFICATE_ISSUED_SELF" : n.type;
          const body = (
            <div
              className={cn(
                "grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-surface p-3",
                n.read ? "border-line" : "border-sky-300 bg-sky-50",
              )}
            >
              <span className={cn("grid size-10 place-items-center rounded-[12px]", tint)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <b className="block text-[15px]">{t(`types.${key}.title`, values)}</b>
                <small className="block text-xs text-muted">
                  {t(`types.${key}.body`, values)}
                  {" · "}
                  {format.relativeTime(n.createdAt)}
                </small>
              </span>
              {!n.read ? (
                <span className="size-2.5 rounded-full bg-primary" aria-label={t("unread")} role="img" />
              ) : (
                <span />
              )}
            </div>
          );
          return (
            <li key={n.id}>
              {href ? (
                <Link href={href} className="block text-fg no-underline hover:opacity-90">
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
