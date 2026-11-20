import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations();
  return (
    <main className="sky-gradient grid min-h-dvh place-items-center px-4 text-center">
      <div className="grid justify-items-center gap-4">
        <p className="font-display text-[5rem] leading-none font-extrabold text-primary">404</p>
        <h1 className="text-2xl font-extrabold">{t("notFound.title")}</h1>
        <p className="text-muted">{t("notFound.body")}</p>
        <Link href="/" className={buttonVariants()}>
          {t("common.backHome")}
        </Link>
      </div>
    </main>
  );
}
