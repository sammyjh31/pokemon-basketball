import {
  calculateRookieDraftJob,
  type RookieDraftJob,
  type RookieDraftResult,
  type RookieDraftProgress,
} from "./rookieDraftJobs";

/** Keep exhaustive CPU recruiting off the page; publish only the completed transaction. */
export function runRookieDraftJob<J extends RookieDraftJob>(
  job: J,
  signal = new AbortController().signal,
  onProgress?: RookieDraftProgress,
): Promise<RookieDraftResult<J>> {
  if (signal.aborted) return Promise.reject(signal.reason);
  if (typeof Worker === "undefined") {
    // Also yield in test/older environments so loading feedback can paint first.
    return new Promise((resolve, reject) => {
      const abort = () => {
        clearTimeout(timer);
        reject(signal.reason);
      };
      const timer = setTimeout(() => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) return reject(signal.reason);
        try {
          resolve(calculateRookieDraftJob(job, onProgress));
        } catch (error) {
          reject(error);
        }
      }, 0);
      signal.addEventListener("abort", abort, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./rookieDraft.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch (error) {
      reject(error);
      return;
    }
    const finish = () => {
      signal.removeEventListener("abort", abort);
      worker.terminate();
    };
    const abort = () => {
      finish();
      reject(signal.reason);
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = ({
      data,
    }: MessageEvent<
      | { progress: [number, number] }
      | { result: RookieDraftResult<J> }
      | { error: string }
    >) => {
      if ("progress" in data) {
        onProgress?.(...data.progress);
        return;
      }
      finish();
      if ("error" in data) reject(new Error(data.error));
      else resolve(data.result);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish();
      reject(
        new Error(
          "The rookie draft could not finish. Your saved progress is unchanged. Please try again.",
        ),
      );
    };
    try {
      worker.postMessage(job);
    } catch (error) {
      finish();
      reject(error);
    }
  });
}
