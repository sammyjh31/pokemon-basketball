import { expect, it } from "vitest";
import { finishedGame, officialFixture } from "./officialGame.testUtils";
import {
  officialGameFromArcade,
  validateOfficialGame,
  validateStoredOfficialGame,
} from "./officialGame";
import {
  advanceMorale,
  applyMoraleSnapshot,
  snapshotMorale,
  teamsWithMorale,
} from "./playerMorale";
import {
  nextFranchiseFixture,
  replaySeasonProgress,
} from "./interactiveSeason";

it("freezes away-team morale, reports scaled actual minutes, and validates stored snapshots and reports", () => {
  const { fixture, teams } = officialFixture(true);
  teams[0].morale![teams[0].roster.PG!].score = 70;
  const frozen = {
    ...fixture,
    morale: snapshotMorale(
      teams[fixture.homeTeamId],
      teams[fixture.awayTeamId],
    ),
  };
  const state = finishedGame(frozen, teams, 1);
  const game = officialGameFromArcade(state, frozen, teams);
  expect(game.moraleVersion).toBe(1);
  expect(game.morale).toEqual(frozen.morale);
  const report = game.match.moraleReport!.away;
  const after = advanceMorale(
    teams[0],
    game.match.awayBox,
    game.match.awayScore > game.match.homeScore,
    1,
  );
  for (const row of report) expect(row.after).toBe(after[row.pokemonId].score);
  expect(validateStoredOfficialGame(game, fixture, teams)).toEqual(game);
  for (const mutate of [
    (g: typeof game) => {
      delete g.moraleVersion;
    },
    (g: typeof game) => {
      g.morale!.away[0] += 1;
    },
    (g: typeof game) => {
      g.morale!.home.push(50);
    },
    (g: typeof game) => {
      g.match.moraleReport!.away[0].after += 1;
    },
    (g: typeof game) => {
      delete g.match.moraleReport;
    },
  ]) {
    const bad = structuredClone(game);
    mutate(bad);
    expect(() => validateOfficialGame(bad, frozen, teams)).toThrow();
  }
  const wrong = structuredClone(game);
  wrong.morale!.home[1] = 49;
  expect(() => validateStoredOfficialGame(wrong, fixture, teams)).toThrow();
});

it("credits each official game once and freezes the latest bank into the next fixture", () => {
  const { run, teams } = officialFixture();
  const fixture = nextFranchiseFixture(run)!;
  const game = officialGameFromArcade(
    finishedGame(fixture, teams),
    fixture,
    teams,
  );
  const playedGames = { [fixture.id]: game };
  const result = replaySeasonProgress(run, 1, playedGames);
  const userHome = fixture.homeTeamId === 0;
  const initial = applyMoraleSnapshot(
    teams[0],
    fixture.morale![userHome ? "home" : "away"],
  );
  expect(result.league!.morale![0]).toEqual(
    advanceMorale(
      initial,
      game.match[userHome ? "homeBox" : "awayBox"],
      userHome
        ? game.match.homeScore > game.match.awayScore
        : game.match.awayScore > game.match.homeScore,
      game.match.overtimePeriods,
    ),
  );
  expect(replaySeasonProgress(run, 1, playedGames)).toEqual(result);
  const next = nextFranchiseFixture({
    ...run,
    seasonProgress: {
      modelVersion: 1,
      completedRounds: 1,
      playedGames,
      result,
    },
  })!;
  const current = teamsWithMorale(teams, result.league!.morale);
  expect(next.morale).toEqual(
    snapshotMorale(current[next.homeTeamId], current[next.awayTeamId]),
  );
});
