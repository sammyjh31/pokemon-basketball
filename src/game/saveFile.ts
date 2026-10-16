/** Exported save files wrap the stored save text with what kind of save it is. */
export type SaveKind = "game" | "local-league";
export const SAVE_FILE_FORMAT = "pokemon-basketball-save";

export function saveFileText(kind: SaveKind, save: unknown, now = new Date()) {
  return JSON.stringify({
    format: SAVE_FILE_FORMAT,
    kind,
    exportedAt: now.toISOString(),
    save,
  });
}

export function saveFileName(kind: SaveKind, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `pokemon-basketball-${kind === "game" ? "franchise" : "local-league"}-${date}.json`;
}

/**
 * Returns the save text inside an exported file, or a bare save copied from
 * browser storage. Validation of the save itself is left to the game parsers.
 */
export function readSaveFile(text: string, kind: SaveKind): string {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("This file is not a Pokémon Basketball save.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("This file is not a Pokémon Basketball save.");
  const root = value as Record<string, unknown>;
  const fileKind: SaveKind | null =
    root.format === SAVE_FILE_FORMAT
      ? root.kind === "game" || root.kind === "local-league"
        ? root.kind
        : null
      : Object.hasOwn(root, "managers")
        ? "local-league"
        : Object.hasOwn(root, "run")
          ? "game"
          : null;
  if (!fileKind) throw new Error("This file is not a Pokémon Basketball save.");
  if (fileKind !== kind)
    throw new Error(
      fileKind === "game"
        ? "This is a solo or franchise save. Import it from the main game."
        : "This is a local league save. Import it from Local league.",
    );
  return root.format === SAVE_FILE_FORMAT ? JSON.stringify(root.save) : text;
}

export function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
