import "server-only";
import type { NotificationType } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

/**
 * In-cabinet notification feed (spec §8; e-mail delivery is a later adapter).
 * Students' LEVEL_UP notifications are not listed: they drive the one-time
 * build animation on the city screen, which marks them as seen.
 */
const HIDDEN_FOR: Partial<Record<SessionUser["role"], NotificationType[]>> = { STUDENT: ["LEVEL_UP"] };

const visible = (user: SessionUser) => ({
  recipientId: user.id,
  ...(HIDDEN_FOR[user.role] ? { type: { notIn: HIDDEN_FOR[user.role] } } : {}),
});

export type FeedItem = {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  subject: { id: string; firstName: string; lastName: string } | null;
  createdAt: Date;
  read: boolean;
};

export async function getFeed(user: SessionUser, take = 50): Promise<FeedItem[]> {
  const rows = await db.notification.findMany({
    where: visible(user),
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      type: true,
      payload: true,
      createdAt: true,
      readAt: true,
      subject: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    subject: r.subject,
    createdAt: r.createdAt,
    read: r.readAt != null,
  }));
}

export async function unreadCount(user: SessionUser) {
  return db.notification.count({ where: { ...visible(user), readAt: null } });
}

/** Marks the user's own visible notifications as read (all, or the given ids). */
export async function markRead(user: SessionUser, ids?: string[]) {
  await db.notification.updateMany({
    where: { ...visible(user), readAt: null, ...(ids ? { id: { in: ids } } : {}) },
    data: { readAt: new Date() },
  });
}

/** Achievement names for ACHIEVEMENT_EARNED payloads. */
export async function achievementNames() {
  const rows = await db.achievement.findMany({ select: { key: true, nameKk: true, nameRu: true } });
  return Object.fromEntries(rows.map((r) => [r.key, { kk: r.nameKk, ru: r.nameRu }]));
}
