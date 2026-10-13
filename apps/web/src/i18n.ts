import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "./locales/en";
import { nl, type Messages } from "./locales/nl";

export const languages = ["nl", "en"] as const;
export type Language = (typeof languages)[number];

declare module "i18next" {
  interface CustomTypeOptions {
    resources: { translation: Messages };
  }
}

const STORAGE_KEY = "gerage.language";

/** The language picked before, or Dutch. Storage can be blocked, e.g. in a private window. */
function storedLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return languages.find((l) => l === stored) ?? "nl";
  } catch {
    return "nl";
  }
}

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Not remembered, but the switch still works for this visit.
  }
});

void i18n.use(initReactI18next).init({
  resources: { nl: { translation: nl }, en: { translation: en } },
  lng: storedLanguage(),
  fallbackLng: "nl",
  supportedLngs: languages,
  interpolation: { escapeValue: false },
});

export default i18n;
