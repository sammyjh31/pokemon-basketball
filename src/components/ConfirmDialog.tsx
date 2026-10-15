import { useEffect, useRef } from "react";
export function ConfirmDialog({
  onConfirm,
  onCancel,
  title = "Back to the draft?",
  confirmLabel = "Start new run",
}: {
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="confirm-dialog"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-description"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
          if (e.key === "Tab") {
            const buttons = ref.current!.querySelectorAll("button"),
              first = buttons[0],
              last = buttons[buttons.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <span className="eyebrow">A FRESH START</span>
        <h2 id="dialog-title">{title}</h2>
        <p id="dialog-description">
          This replaces your current lineup. Your completed season records will
          stay saved.
        </p>
        <div className="dialog-actions">
          <button className="button secondary" onClick={onCancel}>
            Keep playing
          </button>
          <button className="button primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
