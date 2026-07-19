import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "@/locales/en/common.json";

export const SUPPORTED_LANGS = ["en", "de", "hi"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANG_STORAGE_KEY = "rentready:lang";

const loaded = new Set<string>(["en"]);

export async function ensureLangLoaded(lang: string) {
  if (loaded.has(lang)) return;
  if (!SUPPORTED_LANGS.includes(lang as Lang)) return;
  const mod = await (lang === "de"
    ? import("@/locales/de/common.json")
    : import("@/locales/hi/common.json"));
  i18n.addResourceBundle(lang, "common", (mod as any).default ?? mod, true, true);
  loaded.add(lang);
}

export async function setAppLanguage(lang: string) {
  await ensureLangLoaded(lang);
  await i18n.changeLanguage(lang);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: { en: { common: en } },
      fallbackLng: "en",
      supportedLngs: [...SUPPORTED_LANGS],
      ns: ["common"],
      defaultNS: "common",
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: LANG_STORAGE_KEY,
        caches: ["localStorage"],
      },
      returnEmptyString: false,
    });

  // Lazy-load current language if not English
  const cur = i18n.language?.split("-")[0] ?? "en";
  if (cur !== "en") void ensureLangLoaded(cur).then(() => i18n.changeLanguage(cur));
}

export default i18n;
