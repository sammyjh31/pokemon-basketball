import { useEffect, useMemo, useState } from "react";
import {
  runDraftPoolJob,
  type DraftPoolJob,
  type DraftPoolResult,
} from "../game/draftPoolJobs";

const workersAvailable = typeof Worker !== "undefined";

/**
 * Runs pool-wide scouting in the draft worker so typing and clicking stay
 * responsive. Obsolete jobs are cancelled and never shown for a newer roster.
 * Without worker support the work runs inline, exactly as before.
 */
export function useDraftPool<J extends DraftPoolJob>(job: J | null) {
  const inline = useMemo(
    () => (!workersAvailable && job ? runDraftPoolJob(job) : undefined),
    [job],
  );
  const [result, setResult] = useState<{
    job: J;
    value: DraftPoolResult<J>;
  } | null>(null);
  useEffect(() => {
    if (!job || !workersAvailable) return;
    let stopped = false,
      worker: Worker | undefined,
      timer: ReturnType<typeof setTimeout> | undefined;
    const receive = (value: DraftPoolResult<J>) => {
      if (!stopped) setResult({ job, value });
    };
    const fallback = () => {
      timer = setTimeout(() => {
        if (!stopped) receive(runDraftPoolJob(job));
      }, 0);
    };
    try {
      worker = new Worker(
        new URL("../game/draftLineup.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = ({ data }) => receive(data.result);
      worker.onerror = (event) => {
        event.preventDefault();
        worker?.terminate();
        fallback();
      };
      worker.postMessage(job);
    } catch {
      fallback();
    }
    return () => {
      stopped = true;
      worker?.terminate();
      clearTimeout(timer);
    };
  }, [job]);
  const value = inline ?? (result?.job === job ? result.value : undefined);
  return { value, pending: !!job && value === undefined };
}
