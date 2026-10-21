import {
  calculateRookieDraftJob,
  type RookieDraftJob,
} from "./rookieDraftJobs";
self.onmessage = ({ data }: MessageEvent<RookieDraftJob>) => {
  try {
    self.postMessage({
      result: calculateRookieDraftJob(data, (completed, total) =>
        self.postMessage({ progress: [completed, total] }),
      ),
    });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
