import { en, type I18nDictionary } from "./en";
import { zhCN } from "./zh-CN";

export type Locale = "en" | "zh-CN";
export type I18nKey = keyof typeof en;
export const supportedLocales = ["en", "zh-CN"] as const satisfies readonly Locale[];

const dictionaries: Record<Locale, I18nDictionary> = {
  en,
  "zh-CN": zhCN
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && supportedLocales.includes(value as Locale);
}

export function t(locale: Locale, key: I18nKey): string {
  const dictionary = dictionaries[locale] as Partial<I18nDictionary>;
  const localizedValue = dictionary[key];

  if (localizedValue !== undefined) {
    return localizedValue;
  }

  warnMissingI18nKey(locale, key);

  return dictionaries.en[key] ?? key;
}

function warnMissingI18nKey(locale: Locale, key: I18nKey): void {
  if (import.meta.env.DEV) {
    console.warn(`[i18n] Missing translation key "${key}" for locale "${locale}".`);
  }
}
