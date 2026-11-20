import { ChevronRight, CircleCheck, FileText, Mic, PartyPopper, Pencil, RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { getRecentlyReviewed, getReviewQueue } from "@/lib/teacher/review";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("review");
  return { title: t("title") };
}

const TYPE_ICON = { ESSAY: FileText, CREATIVE: Pencil, AUDIO: Mic } as const;

/** Manual review queue (wireframe §4.1 "Review queue", spec §2.2). */
export default async function ReviewQueuePage() {
  const user = await requireRole("TEACHER", "ADMIN");
  const [queue, recent] = await Promise.all([getReviewQueue(user), getRecentlyReviewed(user)]);
  const t = await getTranslations("review");
  const format = await getFormatter();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <p className="mt-1 font-bold text-muted">{t("pending", { count: queue.length })}</p>
      </div>

      {queue.length === 0 ? (
        <Card className="grid justify-items-center gap-3 py-10 text-center">
          <PartyPopper className="size-10 text-sun-600" aria-hidden />
          <p className="font-bold">{t("empty")}</p>
        </Card>
      ) : (
        <ul className="grid gap-2.5">
          {queue.map((a) => {
            const Icon = TYPE_ICON[a.task.type as keyof typeof TYPE_ICON] ?? FileText;
            return (
              <li key={a.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <span className="grid size-10 place-items-center rounded-md bg-violet-100 text-violet-700">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {a.student.firstName} {a.student.lastName}
                      {a.student.memberships[0] && (
                        <span className="font-semibold text-muted"> · {a.student.memberships[0].class.name}</span>
                      )}
                    </p>
                    <p className="text-sm text-muted">
                      {a.task.title} · {t("attemptN", { n: a.number })}
                      {a.submittedAt &&
                        ` · ${format.dateTime(a.submittedAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
                    </p>
                  </div>
                  <Link href={`/teacher/review/${a.id}`} className={buttonVariants({ size: "sm" })}>
                    {t("open")}
                    <ChevronRight aria-hidden />
                  </Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <section aria-labelledby="recent" className="grid gap-2">
          <h2 id="recent" className="text-lg font-bold">
            {t("recent")}
          </h2>
          <ul className="grid gap-1.5 text-sm">
            {recent.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-md bg-surface px-3 py-2">
                {a.status === "GRADED" ? (
                  <CircleCheck className="size-4 shrink-0 text-grass-700" aria-hidden />
                ) : (
                  <RotateCcw className="size-4 shrink-0 text-coral-700" aria-hidden />
                )}
                <span className="font-bold">
                  {a.student.firstName} {a.student.lastName}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted">{a.task.title}</span>
                <span className="font-extrabold">{a.status === "GRADED" ? `${a.score}/10` : t("returned")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
