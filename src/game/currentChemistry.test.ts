import { expect, it } from "vitest";
import { currentChemistryBanks } from "./currentChemistry";
import { insightLeague } from "./insightAnalysis.testUtils";
import { initialState } from "./state";

it("uses the latest completed fixture banks for current previews", () => {
  const run = initialState(7).run;
  const result = {
    games: [],
    wins: 1,
    losses: 0,
    mvpId: 1,
    modelVersion: 6 as const,
    league: { ...insightLeague(), chemistryBonds: { 0: { "1:2": 20 } } },
  };
  run.seasonProgress = {
    modelVersion: 1,
    completedRounds: 1,
    playedGames: {},
    result,
  };
  expect(currentChemistryBanks(run)?.[0]).toEqual({ "1:2": 20 });
  run.result = {
    ...result,
    league: { ...result.league, chemistryBonds: { 0: { "1:2": 80 } } },
  };
  expect(currentChemistryBanks(run)?.[0]).toEqual({ "1:2": 80 });
  run.playoffs = {
    modelVersion: 2,
    seeds: [],
    series: [],
    players: [],
    finalsPlayers: [],
    championId: null,
    finalsMvp: null,
    chemistryBonds: { 0: { "1:2": 120 } },
  };
  expect(currentChemistryBanks(run)?.[0]).toEqual({ "1:2": 120 });
  expect(run.seasonProgress.result?.league?.chemistryBonds?.[0]).toEqual({
    "1:2": 20,
  });
});
