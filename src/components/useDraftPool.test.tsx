import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { POKEMON } from "../data/pokemon";
import { recommendRosterPicks } from "../game/draftAdvice";
import { runDraftPoolJob, type DraftPoolJob } from "../game/draftPoolJobs";
import { emptyRoster } from "../game/types";

const posted: { worker: FakeWorker; job: DraftPoolJob }[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  terminated = false;
  postMessage(job: DraftPoolJob) {
    posted.push({ worker: this, job });
  }
  terminate() {
    this.terminated = true;
  }
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  posted.length = 0;
});

it("matches the inline recommendation exactly", () => {
  const pool = POKEMON.slice(0, 40);
  const job = {
    kind: "advice" as const,
    pool,
    roster: emptyRoster(),
    tactic: "balanced" as const,
  };
  expect(runDraftPoolJob(job)).toEqual(
    recommendRosterPicks(pool, emptyRoster(), "balanced", pool.length),
  );
});

it("waits for the worker and drops results from a superseded job", async () => {
  vi.stubGlobal("Worker", FakeWorker);
  const { useDraftPool } = await import("./useDraftPool");
  const first: DraftPoolJob = {
    kind: "advice",
    pool: POKEMON.slice(0, 10),
    roster: emptyRoster(),
    tactic: "balanced",
  };
  const second: DraftPoolJob = { ...first, pool: POKEMON.slice(10, 20) };
  const { result, rerender } = renderHook(({ job }) => useDraftPool(job), {
    initialProps: { job: first },
  });
  expect(result.current).toEqual({ value: undefined, pending: true });
  rerender({ job: second });
  expect(posted[0].worker.terminated).toBe(true);
  // A late reply from the cancelled worker must never surface.
  act(() => posted[0].worker.onmessage?.({ data: { result: ["stale"] } }));
  expect(result.current.pending).toBe(true);
  const fresh = runDraftPoolJob(second);
  act(() => posted[1].worker.onmessage?.({ data: { result: fresh } }));
  expect(result.current).toEqual({ value: fresh, pending: false });
});
