import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * A centred modal <dialog> asking to confirm something destructive. Mounted while open, like
 * the Drawer. Cancel has focus first, so pressing Enter by accident doesn't confirm.
 */
export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel,
  disabled,
  onConfirm,
  onCancel,
  children,
}: {
  title: string;
  confirmLabel: string;
  cancelLabel: string;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = dialog.current!;
    d.showModal();
    cancel.current?.focus();
    return () => d.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="confirm"
      role="alertdialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      // A click on the dialog itself, not its content, is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="confirm-panel">
        <h2 id={titleId}>{title}</h2>
        <div className="confirm-body">{children}</div>
        <div className="confirm-actions">
          <button ref={cancel} type="button" className="secondary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="danger" disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
