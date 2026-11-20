import { Construction } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";

/** Page header + placeholder used by cabinet sections that later stages implement. */
export async function ComingSoon({ title, stage }: { title: string; stage: number }) {
  const t = await getTranslations("common");
  return (
    <>
      <h1 className="mb-5 text-2xl font-extrabold sm:text-3xl">{title}</h1>
      <Card className="grid justify-items-center gap-3 py-12 text-center">
        <span className="grid size-16 place-items-center rounded-lg bg-sun-100 text-sun-700">
          <Construction className="size-8" aria-hidden />
        </span>
        <h2 className="text-xl font-bold">{t("comingSoonTitle")}</h2>
        <p className="max-w-md text-muted">{t("comingSoonBody", { stage })}</p>
      </Card>
    </>
  );
}
