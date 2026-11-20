import { defineRouting } from "next-intl/routing";

export const locales = ["kk", "ru"] as const;
export type Locale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  // Kazakh is the default UI language (spec); Russian is the second UI language.
  // Learning content (tasks) is always in Russian regardless of UI language.
  defaultLocale: "kk",
  localePrefix: "always",
});
