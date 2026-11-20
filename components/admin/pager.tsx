import { ChevronLeft, ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Previous / next links for a paged admin table; keeps the current filters. */
export async function Pager({
  page,
  pages,
  href,
  query,
}: {
  page: number;
  pages: number;
  href: string;
  query: Record<string, string>;
}) {
  if (pages <= 1) return null;
  const t = await getTranslations("admin");
  const to = (p: number) => {
    const params = new URLSearchParams(Object.entries({ ...query, page: String(p) }).filter(([, v]) => v));
    return `${href}?${params}`;
  };
  return (
    <nav aria-label={t("pager")} className="flex items-center justify-end gap-3 text-sm font-bold">
      {page > 1 && (
        <Link href={to(page - 1)} className="inline-flex items-center gap-1 text-primary-edge">
          <ChevronLeft className="size-4" aria-hidden />
          {t("prev")}
        </Link>
      )}
      <span className="text-muted tabular-nums">
        {page} / {pages}
      </span>
      {page < pages && (
        <Link href={to(page + 1)} className="inline-flex items-center gap-1 text-primary-edge">
          {t("next")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
