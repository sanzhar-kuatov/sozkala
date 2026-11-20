import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing, type Locale } from "./routing";

/**
 * Resolves the UI locale for the current request:
 * 1. an explicit override, e.g. `getTranslations({ locale: "ru" })`;
 * 2. the `[locale]` root param (Server Components);
 * 3. the locale header set by `proxy.ts` (Server Actions, Route Handlers,
 *    where root params are unavailable);
 * 4. the default locale.
 */
async function resolveLocale(
  explicit: string | undefined,
  requestLocale: Promise<string | undefined>,
): Promise<Locale> {
  let candidate = explicit;
  if (!candidate) {
    try {
      candidate = await rootLocale();
    } catch {
      candidate = await requestLocale;
    }
  }
  return hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;
}

export default getRequestConfig(async ({ locale, requestLocale }) => {
  const resolved = await resolveLocale(locale, requestLocale);
  return {
    locale: resolved,
    timeZone: "Asia/Almaty",
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
