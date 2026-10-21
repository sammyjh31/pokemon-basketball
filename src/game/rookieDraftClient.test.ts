import { afterEach, expect, it, vi } from "vitest";
import { runRookieDraftJob } from "./rookieDraftClient";
import { rookieFixture } from "./rookieDraft.testUtils";

afterEach(() => vi.unstubAllGlobals());

it("yields before calculating a rookie draft when workers are unavailable and keeps the source save unchanged", async () => {
  vi.stubGlobal("Worker", undefined);
  const source = rookieFixture();
  const snapshot = JSON.stringify(source);
  let completed = false;
  const pending = runRookieDraftJob({
    kind: "solo-action",
    state: source,
    action: { type: "BEGIN_ROOKIE_DRAFT" },
  }).then((result) => {
    completed = true;
    return result;
  });
  await Promise.resolve();
  expect(completed).toBe(false);
  const result = await pending;
  expect(result.franchise!.rookieDrafts![0]).toMatchObject({
    year: 1,
    complete: false,
    picks: [],
  });
  expect(JSON.stringify(source)).toBe(snapshot);
});

it("does not apply a canceled rookie job", async () => {
  vi.stubGlobal("Worker", undefined);
  const controller = new AbortController();
  const pending = runRookieDraftJob(
    {
      kind: "solo-action",
      state: rookieFixture(),
      action: { type: "BEGIN_ROOKIE_DRAFT" },
    },
    controller.signal,
  );
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
});

it("reports a failed worker without rerunning the transaction on the page", async () => {
  class FailedWorker {
    onerror: ((event: { preventDefault: () => void }) => void) | null = null;
    postMessage() {
      queueMicrotask(() => this.onerror?.({ preventDefault: () => {} }));
    }
    terminate() {}
  }
  vi.stubGlobal("Worker", FailedWorker);
  const state = rookieFixture();
  const before = JSON.stringify(state);
  await expect(
    runRookieDraftJob({
      kind: "solo-action",
      state,
      action: { type: "BEGIN_ROOKIE_DRAFT" },
    }),
  ).rejects.toThrow("saved progress is unchanged");
  expect(JSON.stringify(state)).toBe(before);
});

it("reports CPU draft progress and returns the exhausted draft as one complete result", async () => {
  vi.stubGlobal("Worker", undefined);
  const source = rookieFixture();
  source.franchise!.history[0].standings[0].wins = 82;
  const { ROOKIE_POKEMON } = await import("../data/pokemon");
  source.franchise!.history[0].rosters.push(
    ROOKIE_POKEMON.filter(
      (mon) => mon.generation === 3 && mon.id !== 252 && mon.id !== 253,
    ).map((mon) => mon.id),
  );
  const completed: number[] = [];
  const next = await runRookieDraftJob(
    {
      kind: "solo-action",
      state: source,
      action: { type: "BEGIN_ROOKIE_DRAFT" },
    },
    undefined,
    (count) => completed.push(count),
  );
  expect(completed).toContain(1);
  expect(completed.at(-1)).toBe(60);
  expect(next.franchise!.rookieDrafts![0]).toMatchObject({
    complete: true,
    exhausted: true,
  });
  expect(next.franchise!.rookieDrafts![0].picks).toHaveLength(2);
  expect(source.franchise!.rookieDrafts).toBeUndefined();
});
