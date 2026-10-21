import { useEffect, useState } from "react";
import { createLineupDraftProjector } from "../game/draftLineup";
import type { DraftImpactProjection } from "../game/draftImpact";
import type { DraftLineupJob } from "../game/draftLineupJobs";

/** Cancels obsolete jobs; never exposes rankings made for a different roster/priority. */
export function useDraftLineup(job: DraftLineupJob | null) {
  const [result, setResult] = useState<{
    job: DraftLineupJob;
    done: number;
    projections?: DraftImpactProjection[];
  } | null>(null);
  useEffect(() => {
    if (!job) return;
    let stopped = false,
      worker: Worker | undefined,
      timer: ReturnType<typeof setTimeout>;
    const receive = (data: {
      done: number;
      projections?: DraftImpactProjection[];
    }) => {
      if (!stopped) setResult({ job, ...data });
    };
    // Small chunks also support browsers where workers are unavailable/blocked.
    const fallback = () => {
      let project: ReturnType<typeof createLineupDraftProjector>;
      let i = 0;
      const projections: DraftImpactProjection[] = [];
      const step = () => {
        if (stopped) return;
        project ??= createLineupDraftProjector(
          job.roster,
          job.tactic,
          job.rotation,
          job.focus,
          job.lockedSlots,
          job.shinySeed,
        );
        const end = Math.min(i + 4, job.ids.length);
        for (; i < end; i++) {
          const p = project(job.ids[i]);
          if (p) projections.push(p);
        }
        receive({ done: i, ...(i === job.ids.length ? { projections } : {}) });
        if (i < job.ids.length) timer = setTimeout(step, 0);
      };
      timer = setTimeout(step, 0);
    };
    try {
      worker = new Worker(
        new URL("../game/draftLineup.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = ({ data }) => receive(data);
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
  const current = result?.job === job ? result : null;
  return {
    projections: current?.projections ?? [],
    done: current?.done ?? 0,
    pending: !!job && !current?.projections,
  };
}
