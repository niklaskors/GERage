import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Language } from "./i18n";

/** Each language is named in itself, so you can find yours whatever is selected. */
export const languageOptions: { lang: Language; name: string; Flag: () => React.JSX.Element }[] = [
  { lang: "nl", name: "Nederlands", Flag: DutchFlag },
  { lang: "en", name: "English", Flag: BritishFlag },
];

/** Flag buttons to switch between Dutch (the default) and English. */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <span className="language-switch" role="group" aria-label={t("language.label")}>
      {languageOptions.map(({ lang, name, Flag }) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          title={name}
          aria-label={name}
          aria-pressed={i18n.resolvedLanguage === lang}
          onClick={() => i18n.changeLanguage(lang)}
        >
          <Flag />
        </button>
      ))}
    </span>
  );
}

function DutchFlag() {
  return (
    <svg viewBox="0 0 9 6" aria-hidden="true">
      <rect width="9" height="6" fill="#21468b" />
      <rect width="9" height="4" fill="#fff" />
      <rect width="9" height="2" fill="#ae1c28" />
    </svg>
  );
}

/** The Union Jack, cropped to the same 3:2 as the Dutch flag. */
function BritishFlag() {
  const id = useId();
  return (
    <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id={id}>
        <path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" />
      </clipPath>
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" clipPath={`url(#${id})`} stroke="#c8102e" strokeWidth="4" />
      <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 v30 M0,15 h60" stroke="#c8102e" strokeWidth="6" />
    </svg>
  );
}
