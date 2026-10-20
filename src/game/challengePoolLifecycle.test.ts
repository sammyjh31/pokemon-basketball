import { webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { createRun, placePokemon } from "./draft";
import { ROSTER_SLOTS } from "./types";
import { gameReducer, initialState } from "./state";
import { coachOffers } from "./trainerCoaches";
import { simulateSeason, seasonBuilder } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { rookieProspects } from "./rookieDraft";
import { prepareGameLoad } from "./persistence";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";

it("retains a Gen VII challenge, full mixed league, playoffs and franchise history through cold/warm saves", async () => {
  let run = createRun("spin", false, 53, 7);
  for (const slot of ROSTER_SLOTS)
    run = placePokemon(run, run.offerIds[0], slot);
  let state = gameReducer(
    { ...initialState(53), run },
    { type: "SELECT_COACH", id: coachOffers(run.seasonSeed)[0].id },
  );
  run = state.run;
  const season = simulateSeason(run);
  expect(season.games).toHaveLength(82);
  expect(season.league!.games).toHaveLength(1230);
  expect(season.league!.players).toHaveLength(240);
  expect(season.league!.teams[0].roster).toEqual(run.roster);
  state = gameReducer(state, {
    type: "APPLY_SEASON",
    source: run,
    result: season,
  });
  state = {
    ...state,
    run: {
      ...state.run,
      playoffs: simulatePlayoffs(season.league!, run.seasonSeed),
    },
  };
  const archived = processOffseason(archiveFranchiseSeason(state));
  const used = new Set(
    archived.franchise!.history.flatMap((h) => h.rosters.flat()),
  );
  expect(
    rookieProspects(archived.franchise!, false).every((p) => !used.has(p.id)),
  ).toBe(true);
  const records = memoryReplayRecords();
  const cache = new ReplayCache(
    records.connect(),
    webcrypto as unknown as Crypto,
    "challenge-generations",
  );
  const restore = async (source: string) => {
    const prepared = prepareGameLoad(
      {
        getItem: () => source,
        setItem: () => {
          throw Error("source is read-only");
        },
      },
      99,
    );
    expect(prepared.restore).toBeTypeOf("function");
    const work: number[] = [];
    const value = await prepared.restore!(
      (_done, total) => work.push(total),
      new AbortController().signal,
      cache,
    );
    expect(value.notice).toBeNull();
    return { value, work };
  };
  const cold = await restore(JSON.stringify(archived));
  expect(cold.value.state.run.draftPool).toBe(7);
  expect(cold.value.state.run.result).toEqual(archived.run.result);
  expect(cold.value.state.franchise!.history).toEqual(
    archived.franchise!.history,
  );
  const warm = await restore(JSON.stringify(cold.value.state));
  expect(warm.value.state).toEqual(cold.value.state);
  expect(warm.work.at(-1)).toBe(0);
  const next = startFranchiseSeason(warm.value.state, 54);
  expect(next.run.roster).toEqual(next.franchise!.teams[0].roster);
  expect(next.franchise!.history).toEqual(warm.value.state.franchise!.history);
  const nextLoaded = await restore(JSON.stringify(next));
  expect(nextLoaded.value.state.run.roster).toEqual(next.run.roster);
  expect(nextLoaded.value.state.franchise!.history).toEqual(
    next.franchise!.history,
  );
  const round = seasonBuilder(nextLoaded.value.state.run, 1);
  round.fixtures.forEach(round.play);
  expect(round.finish().league!.games).toHaveLength(15);
}, 600000);
