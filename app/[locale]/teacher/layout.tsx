import { AppShell } from "@/components/shell/app-shell";
import { requireRole } from "@/lib/auth/guards";

/**
 * Teacher cabinet. The layout guard redirects anyone who is not a signed-in TEACHER.
 * Layouts are not a complete security boundary on their own: pages, Server Actions
 * and data functions must also call requireRole()/authorize() (lib/auth/guards.ts).
 */
export default async function TeacherLayout({ children }: LayoutProps<"/[locale]/teacher">) {
  const user = await requireRole("TEACHER");
  return (
    <AppShell role="teacher" user={user}>
      {children}
    </AppShell>
  );
}
