import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { languageOptions } from "./LanguageSwitch";

/** The account menu in the top bar: who is signed in, the language and signing out. */
export function UserMenu({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const current = languageOptions.find((o) => o.lang === i18n.resolvedLanguage) ?? languageOptions[0];

  const items = () => [...(ref.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])];

  const close = (focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    items()[0]?.focus();
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /** Arrow keys move between the items, Escape closes and returns to the button. */
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") return close(true);
    if (e.key === "Tab") return close();
    const all = items();
    const index = all.indexOf(document.activeElement as HTMLElement);
    const next = { ArrowDown: index + 1, ArrowUp: index - 1, Home: 0, End: all.length - 1 }[e.key];
    if (next === undefined) return;
    e.preventDefault();
    all[(next + all.length) % all.length]?.focus();
  };

  return (
    <div className="user-menu" ref={ref} onKeyDown={onKeyDown}>
      <button
        ref={trigger}
        className="user-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("app.menu")}
        title={email}
        onClick={() => setOpen(!open)}
      >
        <span className="avatar" aria-hidden="true">
          {email.charAt(0).toUpperCase()}
        </span>
        <span className="flag" aria-hidden="true">
          <current.Flag />
        </span>
        <svg className="chevron" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu" aria-label={t("app.menu")}>
          <div className="user-menu-account">
            <span className="muted">{t("app.signedInAs")}</span>
            <strong>{email}</strong>
          </div>
          <div className="user-menu-group" role="group" aria-label={t("language.label")}>
            <div className="user-menu-heading">{t("language.label")}</div>
            {languageOptions.map(({ lang, name, Flag }) => (
              <button
                key={lang}
                role="menuitemradio"
                aria-checked={lang === current.lang}
                lang={lang}
                tabIndex={-1}
                onClick={() => {
                  void i18n.changeLanguage(lang);
                  close(true);
                }}
              >
                <span className="flag" aria-hidden="true">
                  <Flag />
                </span>
                {name}
                {lang === current.lang && (
                  <svg className="check" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>
          <button role="menuitem" className="sign-out" tabIndex={-1} onClick={onSignOut}>
            {t("app.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
