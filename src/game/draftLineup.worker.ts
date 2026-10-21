import { runDraftLineupJob, type DraftLineupJob } from "./draftLineupJobs";
import { runDraftPoolJob, type DraftPoolJob } from "./draftPoolJobs";
export type { DraftLineupJob } from "./draftLineupJobs";
self.onmessage = ({ data }: MessageEvent<DraftLineupJob | DraftPoolJob>) => {
  // Advice and fixed-position rankings are single-shot replies.
  if ("kind" in data) {
    self.postMessage({ result: runDraftPoolJob(data) });
    return;
  }
  const projections = runDraftLineupJob(data, (done) =>
    self.postMessage({ done }),
  );
  self.postMessage({ done: data.ids.length, projections });
};
