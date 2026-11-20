import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guards";

/**
 * Admin cabinet. The layout guard redirects anyone who is not a signed-in ADMIN.
 * Layouts are not a complete security boundary on their own: pages, Server Actions
 * and data functions must also call requireRole()/authorize() (lib/auth/guards.ts).
 */
export default async function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  const user = await requireRole("ADMIN");
  return (
    <AppShell role="admin" user={user}>
      {children}
    </AppShell>
  );
}
