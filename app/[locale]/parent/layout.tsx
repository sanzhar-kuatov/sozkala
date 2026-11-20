import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guards";

/**
 * Parent cabinet. The layout guard redirects anyone who is not a signed-in PARENT.
 * Layouts are not a complete security boundary on their own: pages, Server Actions
 * and data functions must also call requireRole()/authorize() (lib/auth/guards.ts).
 */
export default async function ParentLayout({ children }: LayoutProps<"/[locale]/parent">) {
  const user = await requireRole("PARENT");
  return (
    <AppShell role="parent" user={user}>
      {children}
    </AppShell>
  );
}
