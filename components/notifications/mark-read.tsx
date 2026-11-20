"use client";

import { CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { markNotificationsRead } from "@/lib/notifications-actions";

/** Marks the shown unread notifications as read shortly after the page opens (they stay highlighted until then). */
export function MarkReadOnView({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    const timer = setTimeout(() => void markNotificationsRead(key.split(",")), 1500);
    return () => clearTimeout(timer);
  }, [key]);
  return null;
}

export function MarkAllReadButton({ disabled }: { disabled: boolean }) {
  const t = useTranslations("notifications");
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={disabled || pending}
      onClick={() => start(() => markNotificationsRead())}
    >
      <CheckCheck aria-hidden />
      {t("markAll")}
    </Button>
  );
}
