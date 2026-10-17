import { Dialog } from "./Dialog";
export function ConfirmDialog({
  onConfirm,
  onCancel,
  title = "Start a new run?",
  confirmLabel = "Start new run",
  description = "This clears your current lineup. Your completed season records will stay saved.",
  eyebrow = "A FRESH START",
}: {
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <Dialog
      title={title}
      eyebrow={eyebrow}
      description={description}
      onClose={onCancel}
    >
      <div className="dialog-actions">
        <button className="button secondary" onClick={onCancel}>
          Keep playing
        </button>
        <button className="button primary" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
