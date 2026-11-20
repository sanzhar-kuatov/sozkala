import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { PasswordForm } from "./password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("title") };
}

/** Own account for every role: profile summary and password change. */
export default async function AccountPage() {
  const user = await requireRole();
  const t = await getTranslations();
  const role = user.role.toLowerCase() as "student" | "teacher" | "parent" | "admin";
  return (
    <AppShell role={role} user={user}>
      <div className="grid gap-5">
        <h1 className="text-2xl font-extrabold sm:text-3xl">{t("account.title")}</h1>
        <Card className="grid gap-1">
          <p className="text-lg font-bold">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-muted">
            {t("account.login")}: <span className="font-mono">{user.login}</span>
          </p>
        </Card>
        <Card className="grid gap-3">
          <h2 className="text-lg font-bold">{t("account.password")}</h2>
          <PasswordForm />
        </Card>
        <Link href="/privacy" className="text-sm font-bold text-primary-edge">
          {t("privacy.link")}
        </Link>
      </div>
    </AppShell>
  );
}
