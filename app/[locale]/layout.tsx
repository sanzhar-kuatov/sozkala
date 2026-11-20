import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Nunito, Rubik } from "next/font/google";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "../globals.css";

// Both families include cyrillic-ext → all Kazakh letters (Ә Ғ Қ Ң Ө Ұ Ү Һ І).
const rubik = Rubik({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["500", "700", "800"],
  variable: "--font-rubik",
  display: "swap",
});
const nunito = Nunito({
  subsets: ["latin", "cyrillic", "cyrillic-ext"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : routing.defaultLocale });
  return {
    title: { default: t("meta.title"), template: `%s · ${t("brand.name")}` },
    description: t("meta.description"),
  };
}

export const viewport: Viewport = {
  themeColor: "#00AFCA",
  width: "device-width",
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={`${rubik.variable} ${nunito.variable}`}>
      <body className="min-h-dvh">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
