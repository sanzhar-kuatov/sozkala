import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NotificationsPage } from "@/components/notifications/notifications-page";
import { requireRole } from "@/lib/auth/guards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

export default async function StudentNotificationsPage() {
  const user = await requireRole("STUDENT");
  return <NotificationsPage user={user} />;
}
