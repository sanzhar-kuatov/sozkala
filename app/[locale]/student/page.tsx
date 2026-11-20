import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CityExplorer } from "@/components/city/city-explorer";
import { requireRole } from "@/lib/auth/guards";
import { getCityView } from "@/lib/student/city";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav.student");
  return { title: t("city") };
}

/** Student home: my city (spec §2.1, §3, §13 step 1). */
export default async function StudentCityPage() {
  const user = await requireRole("STUDENT");
  const view = await getCityView(user, user.id);
  if (!view) notFound();
  return <CityExplorer view={view} />;
}
