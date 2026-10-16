import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./franchiseDetails.css";

export function FranchiseDetailDialog({
  title,
  eyebrow,
  onClose,
  children,
  covered = false,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
  covered?: boolean;
}) {
  const titleId = useId(),
    dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="dialog-overlay franchise-detail-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-hidden={covered || undefined}
    >
      <div
        className="franchise-detail-dialog"
        role="dialog"
        aria-modal={!covered}
        aria-labelledby={titleId}
        ref={dialog}
        onKeyDown={(event) => {
          if (event.defaultPrevented || covered) return;
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab") return;
          const nodes = dialog.current?.querySelectorAll<HTMLElement>(
            'button:not([disabled]), select, [tabindex="0"], a[href]',
          );
          if (!nodes?.length) return;
          const first = nodes[0],
            last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <header className="franchise-detail-heading">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button
            type="button"
            className="box-score-close"
            onClick={onClose}
            aria-label={`Close ${title}`}
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
