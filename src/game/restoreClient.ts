import {
  prepareGameLoad,
  STORAGE_KEY,
  type LoadedGame,
  type PreparedGameLoad,
} from "./persistence";
import { simulateLocalSeasonAsync } from "./localSeason";
import type { LocalLeague } from "./localLeague";
import type { SeasonResult } from "./types";
import type { RestoreJob, RestoreMessage } from "./restore.worker";

type Progress = (completed: number, total: number) => void;

/**
 * Runs a job in the restore worker. Falls back to the page when workers are
 * unavailable or fail; aborting terminates the worker.
 */
function inWorker<T>(
  job: RestoreJob,
  pick: (message: RestoreMessage) => T | undefined,
  fallback: () => Promise<T>,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<T> {
  signal.throwIfAborted();
  let worker: Worker;
  try {
    if (typeof Worker === "undefined") return fallback();
    worker = new Worker(new URL("./restore.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return fallback();
  }
  return new Promise<T>((resolve, reject) => {
    const finish = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(signal.reason);
    };
    const runFallback = () => {
      finish();
      fallback().then(resolve, reject);
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<RestoreMessage>) => {
      if ("progress" in data) return onProgress(...data.progress);
      const result = pick(data);
      if (result === undefined) return runFallback();
      finish();
      resolve(result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      runFallback();
    };
    worker.postMessage(job);
  });
}

/** Completes a deferred saved-game load, replaying its seasons in a worker. */
export function restoreSavedGame(
  prepared: PreparedGameLoad,
  source: string,
  seed: number,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<LoadedGame> {
  const fallback = () =>
    prepared.restore
      ? prepared.restore(onProgress, signal)
      : Promise.resolve(prepared);
  if (!prepared.restore) return fallback();
  return inWorker(
    { kind: "game", source, seed },
    (data) => ("loaded" in data ? data.loaded : undefined),
    fallback,
    onProgress,
    signal,
  );
}

/** Fully validates save text exactly as loading it would. */
export function validateGameSource(
  source: string,
  seed: number,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<LoadedGame> {
  const storage = {
    getItem: (key: string) => (key === STORAGE_KEY ? source : null),
    setItem: () => {},
  };
  return restoreSavedGame(
    prepareGameLoad(storage, seed),
    source,
    seed,
    onProgress,
    signal,
  );
}

/** Replays a local league season in a worker when one is available. */
export function simulateLocalSeasonInWorker(
  draft: LocalLeague,
  onProgress: Progress,
  signal: AbortSignal,
): Promise<SeasonResult> {
  return inWorker(
    { kind: "local-season", draft },
    (data) => ("season" in data ? data.season : undefined),
    () => simulateLocalSeasonAsync(draft, onProgress, signal),
    onProgress,
    signal,
  );
}
