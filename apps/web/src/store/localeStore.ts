import { create } from "zustand";
import { isLocale, type Locale } from "../i18n";

export const LOCALE_STORAGE_KEY = "clawflow.locale";

export interface LocaleStoreState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStoreState>((set) => ({
  locale: readInitialLocale(),
  setLocale: (locale) => {
    writeStoredLocale(locale);
    set({ locale });
  }
}));

function readInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  try {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(storedLocale) ? storedLocale : "en";
  } catch {
    return "en";
  }
}

function writeStoredLocale(locale: Locale): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Ignore storage failures; the in-memory locale still updates.
  }
}
