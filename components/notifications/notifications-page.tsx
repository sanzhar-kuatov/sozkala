import { getTranslations } from "next-intl/server";
import type { SessionUser } from "@/lib/auth/session";
import { getFeed } from "@/lib/notifications-feed";
import { MarkAllReadButton } from "./mark-read";
import { NotificationList } from "./notification-list";

/** Full notifications page body, used by the student, teacher and parent cabinets. */
export async function NotificationsPage({ user }: { user: SessionUser }) {
  const t = await getTranslations("notifications");
  const items = await getFeed(user);
  return (
    <div className="grid max-w-3xl gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-extrabold sm:text-3xl">{t("title")}</h1>
        <MarkAllReadButton disabled={!items.some((i) => !i.read)} />
      </div>
      <p className="text-sm text-muted">{t("emailLater")}</p>
      <NotificationList user={user} items={items} />
    </div>
  );
}
