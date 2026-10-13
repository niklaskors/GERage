import { useEffect, useId, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

/**
 * A panel that slides in from the right (from the bottom on phones) over a dimmed page.
 * A modal <dialog>, so focus stays inside and Esc closes it. Mounted while open: the parent
 * decides when it's shown, and Esc, the close button and a click beside it call `onClose`.
 */
export function Drawer({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { t } = useTranslation();

  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    return () => d.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog itself, not its content, is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="drawer-panel">
        <div className="drawer-header">
          <div>
            <h2 id={titleId}>{title}</h2>
            {subtitle && <p className="muted">{subtitle}</p>}
          </div>
          <button type="button" className="drawer-close" aria-label={t("drawer.close")} onClick={onClose}>
            ×
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </dialog>
  );
}
