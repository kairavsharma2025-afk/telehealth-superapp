import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

// Simple modal dialog — focus trap is light (just focus the cancel
// button on open, close on Escape). Enough for an admin tool.
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={onCancel}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <h3 id="confirm-dialog-title" className="modal-title">{title}</h3>
        {description ? <div className="modal-desc">{description}</div> : null}
        <div className="modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={destructive ? "danger" : ""}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
