import { useEffect, useRef, useState } from "react";
import "../saveMenu.css";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  backupKey,
  isSaveStorage,
  quarantineKey,
  readSlot,
  type StorageLike,
} from "../game/saveStorage";
import {
  downloadText,
  readSaveFile,
  saveFileName,
  saveFileText,
  type SaveKind,
} from "../game/saveFile";

export interface CheckedImport {
  summary: string;
  apply: () => void;
}
export interface SaveControls {
  kind: SaveKind;
  /** Storage key of the primary save. */
  slot: string;
  storage: StorageLike;
  /** Disables changes while a season, restore or other job is running. */
  busy: boolean;
  /** Another tab wrote this save, so this tab has stopped saving. */
  otherTab: boolean;
  /** Current save text, or null when there is nothing to export. */
  exportSave: () => string | null;
  /** Fully validates imported save text without changing anything. */
  checkImport: (
    source: string,
    onProgress: (completed: number, total: number) => void,
    signal: AbortSignal,
  ) => Promise<CheckedImport>;
}

type Pending =
  | { type: "import"; checked: CheckedImport }
  | { type: "backup" }
  | { type: "discard" };

/** Export, import and recovery for one save, plus the other-tab warning. */
export function SaveMenu({
  kind,
  slot,
  storage,
  busy,
  otherTab,
  exportSave,
  checkImport,
}: SaveControls) {
  const [slots, setSlots] = useState(() => ({
    backup: readSlot(storage, backupKey(slot)),
    quarantine: readSlot(storage, quarantineKey(slot)),
  }));
  const refreshSlots = () =>
    setSlots({
      backup: readSlot(storage, backupKey(slot)),
      quarantine: readSlot(storage, quarantineKey(slot)),
    });
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState<AbortController | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => () => checking?.abort(), [checking]);
  // Restore and import run asynchronously; refresh the slots they write.
  useEffect(refreshSlots, [busy, storage, slot]);
  const label = kind === "game" ? "game" : "local league";
  const canRestore =
    !!slots.backup && slots.backup !== slots.quarantine && !otherTab;

  const restoreBackup = async () => {
    const backup = slots.backup;
    if (!backup || !isSaveStorage(storage)) return;
    try {
      storage.setItem(slot, backup);
      await storage.flush();
      window.location.reload();
    } catch {
      setStatus(
        "The backup could not be restored. Browser storage is unavailable.",
      );
    }
  };
  const chooseFile = async (selected: File | undefined) => {
    if (!selected) return;
    const controller = new AbortController();
    setChecking(controller);
    setStatus(`Checking ${selected.name}…`);
    try {
      const source = readSaveFile(await selected.text(), kind);
      const checked = await checkImport(
        source,
        (completed, total) =>
          setStatus(
            `Verifying the imported save · ${completed.toLocaleString()} / ${total.toLocaleString()} games`,
          ),
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setStatus("");
      setPending({ type: "import", checked });
    } catch (error) {
      if (!controller.signal.aborted)
        setStatus(
          error instanceof Error
            ? error.message
            : "This save could not be imported.",
        );
    } finally {
      setChecking((current) => (current === controller ? null : current));
      if (file.current) file.current.value = "";
    }
  };

  return (
    <>
      {otherTab && (
        <p className="notice save-alert" role="alert">
          This {label} was changed in another tab. Saving is paused here so this
          tab cannot overwrite that progress.{" "}
          <button
            className="text-button"
            onClick={() => window.location.reload()}
          >
            Reload to continue
          </button>
        </p>
      )}
      {slots.quarantine && (
        <div className="notice save-alert" role="alert">
          <p>
            A {label} save that could not be restored was set aside so it cannot
            be overwritten.
            {canRestore
              ? " You can restore your last verified backup."
              : " Download it to keep a copy."}
          </p>
          <div className="save-actions">
            {canRestore && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => setPending({ type: "backup" })}
              >
                Restore last verified backup
              </button>
            )}
            <button
              className="button secondary"
              onClick={() =>
                downloadText(
                  saveFileName(kind).replace(".json", "-set-aside.json"),
                  slots.quarantine!,
                )
              }
            >
              Download set-aside save
            </button>
            <button
              className="text-button"
              onClick={() => setPending({ type: "discard" })}
            >
              Discard it
            </button>
          </div>
        </div>
      )}
      <details className="save-menu">
        <summary>Save options</summary>
        <div className="save-actions">
          <button
            className="button secondary"
            onClick={() => {
              const save = exportSave();
              if (!save)
                return setStatus(`There is no ${label} to export yet.`);
              downloadText(
                saveFileName(kind),
                saveFileText(kind, JSON.parse(save)),
              );
              setStatus("Save exported.");
            }}
          >
            Export save
          </button>
          <button
            className="button secondary"
            disabled={busy || otherTab || !!checking}
            onClick={() => file.current?.click()}
          >
            Import save
          </button>
          {canRestore && !slots.quarantine && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setPending({ type: "backup" })}
            >
              Restore last verified backup
            </button>
          )}
          {checking && (
            <button className="text-button" onClick={() => checking.abort()}>
              Cancel import
            </button>
          )}
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label={`Import ${label} save file`}
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </div>
        <p className="save-note">
          Saves stay in this browser. Export a copy to move it or keep it safe.
        </p>
        {status && (
          <p className="save-status" role="status">
            {status}
          </p>
        )}
      </details>
      {pending && (
        <ConfirmDialog
          title={
            pending.type === "import"
              ? "Replace your current save?"
              : pending.type === "backup"
                ? "Restore your last verified backup?"
                : "Discard the set-aside save?"
          }
          description={
            pending.type === "import"
              ? `${pending.checked.summary} This replaces your current ${label}. Export it first if you want to keep it.`
              : pending.type === "backup"
                ? `This replaces your current ${label} with the last save that passed full verification, then reloads the page.`
                : "The damaged save will be deleted from this browser. Download it first if you may need it."
          }
          confirmLabel={
            pending.type === "import"
              ? "Replace save"
              : pending.type === "backup"
                ? "Restore backup"
                : "Discard"
          }
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            if (pending.type === "import") {
              pending.checked.apply();
              setStatus("Save imported.");
              refreshSlots();
            } else if (pending.type === "backup") void restoreBackup();
            else {
              if (isSaveStorage(storage))
                storage.removeItem(quarantineKey(slot));
              refreshSlots();
            }
          }}
        />
      )}
    </>
  );
}
