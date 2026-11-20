import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guards";

/**
 * Student cabinet. The layout guard redirects anyone who is not a signed-in STUDENT.
 * Layouts are not a complete security boundary on their own: pages, Server Actions
 * and data functions must also call requireRole()/authorize() (lib/auth/guards.ts).
 */
export default async function StudentLayout({ children }: LayoutProps<"/[locale]/student">) {
  const user = await requireRole("STUDENT");
  return (
    <AppShell role="student" user={user}>
      {children}
    </AppShell>
  );
}
