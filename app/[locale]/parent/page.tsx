import { ChevronRight, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Link, redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth/guards";
import { linkedChildren } from "@/lib/parent/child";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.parent");
  return { title: t("overview") };
}

/** Parent home: straight to the child's page, or a picker when several children are linked. */
export default async function ParentHome() {
  const user = await requireRole("PARENT");
  const children = await linkedChildren(user);
  if (children.length === 1) redirect({ href: `/parent/child/${children[0].id}`, locale: await getLocale() });

  const t = await getTranslations("parent");
  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{t("chooseChild")}</h1>
      {children.length === 0 ? (
        <Card tone="flat">
          <p className="text-muted">{t("noChildren")}</p>
        </Card>
      ) : (
        <ul className="grid gap-2">
          {children.map((c) => (
            <li key={c.id}>
              <Link href={`/parent/child/${c.id}`} className="block no-underline">
                <Card className="flex items-center gap-3 p-4 hover:bg-cream">
                  <span className="grid size-11 place-items-center rounded-full bg-[#FFE5D3] text-[#B85314]">
                    <UserRound className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold text-fg">{c.name}</span>
                    {c.className && <span className="block text-sm text-muted">{c.className}</span>}
                  </span>
                  <ChevronRight className="size-5 text-ink-300" aria-hidden />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
