import { webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { performanceRun } from "./seasonPerformance.testUtils";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { prepareGameLoad } from "./persistence";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { advanceFranchiseSeasonAsync } from "./interactiveSeason";
it("retains full-league and playoff scouting into a saved partial second franchise season", async () => {
  const run = {
    ...performanceRun(),
    movesetVersion: 3 as const,
    draftPool: "all" as const,
  };
  const result = simulateSeason(run);
  let state = gameReducer(
    { ...initialState(822), run },
    { type: "APPLY_SEASON", source: run, result },
  );
  state = {
    ...state,
    run: {
      ...state.run,
      playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
    },
  };
  const offseason = processOffseason(archiveFranchiseSeason(state));
  expect(
    Object.keys(offseason.franchise!.history[0].coachBook!.coaches),
  ).toHaveLength(30);
  let next = startFranchiseSeason(offseason, 823);
  expect(next.run.leagueTeams!.every((t) => t.scoutingSeed?.year === 2)).toBe(
    true,
  );
  next = { ...next, run: await advanceFranchiseSeasonAsync(next.run, 2) };
  expect(
    next.run.seasonProgress!.result!.league!.games.every(
      (g) => g.scouting!.home.carried === 1 && g.scouting!.away.carried === 1,
    ),
  ).toBe(true);
  const records = memoryReplayRecords(),
    cache = () =>
      new ReplayCache(
        records.connect(),
        webcrypto as unknown as Crypto,
        "coach-scouting",
      );
  const restore = async (raw: string) => {
    const prepared = prepareGameLoad(
      {
        getItem: () => raw,
        setItem: () => {
          throw Error("read only");
        },
      },
      1,
    );
    const work: number[] = [];
    const loaded = await prepared.restore!(
      (_n, total) => work.push(total),
      new AbortController().signal,
      cache(),
    );
    expect(loaded.notice).toBeNull();
    return { loaded, work };
  };
  const cold = await restore(JSON.stringify(next));
  const warm = await restore(JSON.stringify(cold.loaded.state));
  expect(warm.loaded.state).toEqual(cold.loaded.state);
  expect(warm.work.at(-1)).toBe(0);
  expect(warm.loaded.state.run.seasonProgress!.result).toEqual(
    next.run.seasonProgress!.result,
  );
  expect(warm.loaded.state.franchise!.history).toEqual(next.franchise!.history);
}, 600000);
