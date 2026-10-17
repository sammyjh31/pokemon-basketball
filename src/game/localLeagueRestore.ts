import type { LocalLeague } from "./localLeague";

export type LocalRestoreMessage =
  | { type: "progress"; completed: number; total: number }
  | { type: "complete"; draft: LocalLeague }
  | { type: "error"; message: string };

/** Routing only: the worker still validates the entire untrusted save. */
export function needsBackgroundLocalRestore(raw: string): boolean {
  if (raw.length > 5_000_000) return false;
  const value = JSON.parse(raw);
  if (!value?.career) return false;
  return (
    value.chemistryGrowthVersion === 1 ||
    (Array.isArray(value.career.teams) &&
      value.career.teams.some(
        (team: { chemistryGrowthVersion?: unknown } | null) =>
          team?.chemistryGrowthVersion === 1,
      )) ||
    (Array.isArray(value.career.history) &&
      value.career.history.some(
        (season: { teams?: unknown } | null) =>
          Array.isArray(season?.teams) &&
          season.teams.some(
            (team: { chemistryGrowthVersion?: unknown } | null) =>
              team?.chemistryGrowthVersion === 1,
          ),
      ))
  );
}

/** No fallback replays a career on the UI thread if background workers fail. */
export function restoreLocalLeagueInBackground(
  raw: string,
  signal: AbortSignal,
  onProgress: (completed: number, total: number) => void,
): Promise<LocalLeague> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    if (typeof Worker === "undefined")
      throw new Error(
        "This browser cannot verify saved careers in the background. Open this league in a browser with background worker support.",
      );
    const worker = new Worker(
      new URL("./localLeagueRestore.worker.ts", import.meta.url),
      { type: "module" },
    );
    const cleanup = () => {
      signal.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
    };
    const abort = () => {
      cleanup();
      reject(
        new DOMException("Local league restoration cancelled.", "AbortError"),
      );
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<LocalRestoreMessage>) => {
      if (signal.aborted) return;
      if (data.type === "progress") onProgress(data.completed, data.total);
      else {
        cleanup();
        if (data.type === "complete") resolve(data.draft);
        else reject(new Error(data.message));
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      cleanup();
      reject(
        new Error(
          "Background verification could not start. Retry restoring this league.",
        ),
      );
    };
    worker.onmessageerror = () => {
      cleanup();
      reject(
        new Error(
          "Background verification could not read this league. Retry restoring it.",
        ),
      );
    };
    try {
      worker.postMessage(raw);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
