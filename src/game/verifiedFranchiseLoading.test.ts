import { verifiedFranchiseFixture } from "./verifiedFranchise.testUtils";
import { processOffseason } from "./offseason";
import { archiveFranchiseSeason } from "./franchise";
import { simulateSeason } from "./season";
import { createHash, webcrypto } from "node:crypto";
import { beforeAll, expect, it } from "vitest";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { gameReducer } from "./state";
import { simulatePlayoffs } from "./playoffs";
import { startFranchiseSeason } from "./franchise";
import { advanceFranchiseSeasonAsync } from "./interactiveSeason";
import { prepareGameLoad, type LoadedGame } from "./persistence";
import type { GameState } from "./types";

const durable = memoryReplayRecords();
const connect = () =>
  new ReplayCache(
    durable.connect(),
    webcrypto as unknown as Crypto,
    "fixture-rules",
  );
const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
let archived: GameState, cold: LoadedGame;
async function restore(
  state: GameState,
  cache = connect(),
  signal = new AbortController().signal,
) {
  const source = JSON.stringify(state);
  const storage = {
    getItem: () => source,
    setItem: () => {
      throw Error("Restoration must not write the save");
    },
  };
  const prepared = prepareGameLoad(storage, 822);
  const progress: [number, number][] = [];
  const loaded = prepared.restore
    ? await prepared.restore(
        (completed, total) => progress.push([completed, total]),
        signal,
        cache,
      )
    : prepared;
  expect(storage.getItem()).toBe(source);
  return { loaded, progress };
}
beforeAll(async () => {
  archived = verifiedFranchiseFixture();
  expect(archived.franchise!.history[0].replay).toBeDefined();
  const first = await restore(archived);
  expect(first.loaded.notice).toBeNull();
  expect(first.progress.at(-1)![1]).toBeGreaterThanOrEqual(1230);
  cold = first.loaded;
}, 300000);

it("reopens a verified franchise with identical results and history without replaying games", async () => {
  const warm = await restore(archived);
  expect(warm.loaded).toEqual(cold);
  expect(sha(warm.loaded)).toBe(sha(cold));
  expect(warm.progress.at(-1)).toEqual([0, 0]);
});

it("keeps cached active boxes independent of history and subsequent openings", async () => {
  const first = await restore(archived);
  const before =
    first.loaded.state.franchise!.history[0].replay!.regularPlayers[0].points;
  first.loaded.state.run.result!.league!.players[0].points++;
  expect(
    first.loaded.state.franchise!.history[0].replay!.regularPlayers[0].points,
  ).toBe(before);
  expect((await restore(archived)).loaded).toEqual(cold);
});

it("loads new offseason training choices while reusing the unchanged verified season", async () => {
  const changed = gameReducer(cold.state, {
    type: "TRAINING_PLANS",
    plans: {
      [archived.franchise!.teams[0].roster.PG!]: {
        focus: "shooting",
        intensity: "aggressive",
      },
    },
  });
  expect(changed).not.toBe(cold.state);
  const warm = await restore(changed);
  expect(warm.loaded.notice).toBeNull();
  expect(warm.loaded.state.franchise!.trainingPlans).toEqual(
    changed.franchise!.trainingPlans,
  );
  expect(warm.progress.at(-1)).toEqual([0, 0]);
});

it("still rejects altered careers even when the active run and archived year are certified", async () => {
  const changed = structuredClone(archived);
  changed.franchise!.careers[0].regular.points++;
  const records = durable.records.size;
  const loaded = (await restore(changed)).loaded;
  expect(loaded.notice).toMatch(/could not be restored/);
  expect(loaded.preserveSource).toBe(true);
  expect(durable.records.size).toBe(records);
});

it("does not trust a modified historical year or mint certificates for a rejected save", async () => {
  const changed = structuredClone(archived);
  changed.franchise!.history[0].replay!.teams[0].roster.PG =
    changed.franchise!.history[0].replay!.teams[0].roster.SG;
  const records = durable.records.size;
  const loaded = (await restore(changed)).loaded;
  expect(loaded.notice).toBeTruthy();
  expect(loaded.preserveSource).toBe(true);
  expect(durable.records.size).toBe(records);
});

it("advances to a new season and replays only its changed active prefix", async () => {
  let next = startFranchiseSeason(cold.state, 823);
  expect(next.franchise!.year).toBe(2);
  next = { ...next, run: await advanceFranchiseSeasonAsync(next.run, 1) };
  const loaded = await restore(next);
  expect(loaded.loaded.notice).toBeNull();
  expect(loaded.loaded.state.franchise!.history).toEqual(
    next.franchise!.history,
  );
  expect(loaded.loaded.state.run.seasonProgress!.completedRounds).toBe(1);
  expect(loaded.progress.at(-1)).toEqual([15, 15]);
  expect((await restore(next)).progress.at(-1)).toEqual([0, 0]);
}, 300000);

it("honors cancellation before reading cached results without changing the source", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    restore(archived, connect(), controller.signal),
  ).rejects.toThrow();
});

it("falls back to exact replay if the disposable cache cannot be read or written", async () => {
  durable.fail(true);
  try {
    const result = await restore(archived);
    expect(result.loaded.notice).toBeNull();
    expect(sha(result.loaded)).toBe(sha(cold));
    expect(result.progress.at(-1)![1]).toBeGreaterThanOrEqual(1230);
  } finally {
    durable.fail(false);
  }
});

it("replays only the active season if its snapshot was evicted but history remains certified", async () => {
  const records = durable.connect();
  const cache = new ReplayCache(
    {
      ...records,
      read: (id) =>
        id.includes(":solo-active:")
          ? Promise.resolve(undefined)
          : records.read(id),
    },
    webcrypto as unknown as Crypto,
    "fixture-rules",
  );
  const result = await restore(archived, cache);
  expect(result.loaded.notice).toBeNull();
  expect(sha(result.loaded)).toBe(sha(cold));
  expect(result.progress.at(-1)).toEqual([1230, 1230]);
});

it("cancels during an asynchronous cache lookup before returning or certifying a save", async () => {
  const records = durable.connect(),
    controller = new AbortController();
  const cache = new ReplayCache(
    {
      ...records,
      read: async (id) => {
        controller.abort();
        return records.read(id);
      },
    },
    webcrypto as unknown as Crypto,
    "fixture-rules",
  );
  const count = durable.records.size;
  await expect(restore(archived, cache, controller.signal)).rejects.toThrow();
  expect(durable.records.size).toBe(count);
});

it("keeps earlier certificates when a second modern season is archived, then advances to year three", async () => {
  const next = startFranchiseSeason(cold.state, 824);
  const result = simulateSeason(next.run);
  const applied = gameReducer(next, {
    type: "APPLY_SEASON",
    source: next.run,
    result,
  });
  const second = processOffseason(
    archiveFranchiseSeason({
      ...applied,
      run: {
        ...applied.run,
        playoffs: simulatePlayoffs(result.league!, next.run.seasonSeed),
      },
    }),
  );
  expect(second.franchise!.history).toHaveLength(2);
  const restored = await restore(second);
  expect(restored.loaded.notice).toBeNull();
  const latestGames =
    1230 + second.run.playoffs!.series.reduce((n, s) => n + s.games.length, 0);
  expect(restored.progress.at(-1)).toEqual([latestGames, latestGames]);
  const warm = await restore(restored.loaded.state);
  expect(warm.progress.at(-1)).toEqual([0, 0]);
  expect(sha(warm.loaded)).toBe(sha(restored.loaded));
  let third = startFranchiseSeason(warm.loaded.state, 825);
  third = { ...third, run: await advanceFranchiseSeasonAsync(third.run, 1) };
  expect(third.franchise!.year).toBe(3);
  const continued = await restore(third);
  expect(continued.loaded.notice).toBeNull();
  expect(continued.progress.at(-1)).toEqual([15, 15]);
  expect(sha(continued.loaded.state.franchise!.history)).toBe(
    sha(warm.loaded.state.franchise!.history),
  );
}, 600000);
