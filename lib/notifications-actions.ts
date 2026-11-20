"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/auth/guards";
import { markRead } from "@/lib/notifications-feed";

/**
 * Mark notifications as read. Allowed for every role, parents included:
 * it only touches the user's own notifications, never a child's learning data.
 */
export async function markNotificationsRead(ids?: string[]) {
  const user = await authorize();
  await markRead(user, ids ? z.array(z.string().max(40)).max(200).parse(ids) : undefined);
  revalidatePath("/[locale]", "layout");
}
