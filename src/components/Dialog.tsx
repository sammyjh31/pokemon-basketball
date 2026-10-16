import { useEffect, useId, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/** Modal shell: unique ids, focus trap, Escape and backdrop dismissal, focus restore. */
export function Dialog({
  title,
  eyebrow,
  description,
  onClose,
  className = "confirm-dialog",
  children,
}: {
  title: ReactNode;
  eyebrow?: string;
  description?: ReactNode;
  onClose: () => void;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
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
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={className}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-description` : undefined}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const items = ref.current!.querySelectorAll<HTMLElement>(FOCUSABLE),
              first = items[0],
              last = items[items.length - 1];
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
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 id={`${id}-title`}>{title}</h2>
        {description && <p id={`${id}-description`}>{description}</p>}
        {children}
      </div>
    </div>
  );
}
