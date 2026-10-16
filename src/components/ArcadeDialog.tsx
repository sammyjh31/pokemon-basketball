import { useEffect, useId, useRef, type ReactNode } from "react";
export function ArcadeDialog({
  title,
  eyebrow = "EXHIBITION",
  onClose,
  children,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current
      ?.querySelector<HTMLElement>('button,select,input,[tabindex="0"]')
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  return (
    <div className="arcade-modal-shade">
      <div
        className="arcade-modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
          if (event.key === "Tab") {
            const focusable = Array.from(
              ref.current?.querySelectorAll<HTMLElement>(
                'button:not(:disabled),select:not(:disabled),input:not(:disabled),summary,[tabindex="0"]',
              ) ?? [],
            ).filter(
              (el) =>
                !el.closest("details:not([open])") || el.tagName === "SUMMARY",
            );
            const first = focusable[0],
              last = focusable.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <p className="arcade-eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
