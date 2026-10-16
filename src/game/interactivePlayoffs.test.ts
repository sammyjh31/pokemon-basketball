import { describe, expect, it } from "vitest";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade } from "./officialGame";
import {
  createPlayoffs,
  nextUserPlayoffFixture,
  submitPlayoffGame,
  replayPlayoffs,
  playoffGameCount,
  simulatePlayoffs,
} from "./playoffs";
import type { LeagueResult } from "./types";
function setup() {
  const { run, teams } = officialFixture();
  const league: LeagueResult = {
    teams,
    games: [],
    players: [],
    awards: [],
    allLeague: [],
    allDefense: [],
    standings: teams.map((t) => ({
      teamId: t.id,
      wins: 60 - t.id,
      losses: 22 + t.id,
      pointsFor: 9000,
      pointsAgainst: 8500,
      homeWins: 30,
      awayWins: 30 - t.id,
      streak: 1,
      lastTen: 5,
    })),
  };
  return { run, teams, league };
}
describe("official postseason games", () => {
  it("projects CPU games, accepts user games home and away, then replays exactly", () => {
    const { run, teams, league } = setup();
    let current = createPlayoffs(league, run.seasonSeed);
    for (let i = 0; i < 3; i++) {
      const fixture = nextUserPlayoffFixture(league, run.seasonSeed, current)!;
      if (i === 2) expect(fixture.awayTeamId).toBe(0);
      const game = officialGameFromArcade(
        finishedGame(fixture, teams),
        fixture,
        teams,
      );
      current = submitPlayoffGame(league, run.seasonSeed, current, game);
      expect(current.modelVersion).toBe(2);
      expect(current.playedGames![fixture.id]).toEqual(game);
      expect(() =>
        submitPlayoffGame(league, run.seasonSeed, current, game),
      ).toThrow();
      expect(
        replayPlayoffs(
          league,
          run.seasonSeed,
          playoffGameCount(current),
          current.playedGames,
        ),
      ).toEqual(current);
    }
    const complete = simulatePlayoffs(league, run.seasonSeed, current);
    expect(complete.championId).not.toBeNull();
    expect(complete.playedGames).toEqual(current.playedGames);
    expect(
      replayPlayoffs(
        league,
        run.seasonSeed,
        playoffGameCount(complete),
        complete.playedGames,
      ),
    ).toEqual(complete);
  });
  it("keeps Finals official totals and awards exactly once", () => {
    const { run, teams, league } = setup();
    let current = createPlayoffs(league, run.seasonSeed);
    for (let i = 0; i < 16; i++) {
      const fixture = nextUserPlayoffFixture(league, run.seasonSeed, current)!;
      expect(fixture).not.toBeNull();
      current = submitPlayoffGame(
        league,
        run.seasonSeed,
        current,
        officialGameFromArcade(finishedGame(fixture, teams), fixture, teams),
      );
    }
    expect(current.championId).toBe(0);
    expect(current.finalsMvp!.teamId).toBe(0);
    expect(
      current.finalsPlayers
        .filter((p) => p.teamId === 0)
        .slice(0, 5)
        .every((p) => p.gamesPlayed === 4),
    ).toBe(true);
    expect(
      current.finalsPlayers
        .filter((p) => p.teamId === 0)
        .slice(5)
        .every((p) => p.gamesPlayed === 0),
    ).toBe(true);
    expect(nextUserPlayoffFixture(league, run.seasonSeed, current)).toBeNull();
    expect(
      replayPlayoffs(
        league,
        run.seasonSeed,
        playoffGameCount(current),
        current.playedGames,
      ),
    ).toEqual(current);
  });
  it("rejects unconsumed or wrong playoff override identities", () => {
    const { run, teams, league } = setup();
    const fixture = nextUserPlayoffFixture(league, run.seasonSeed)!;
    const game = officialGameFromArcade(
      finishedGame(fixture, teams),
      fixture,
      teams,
    );
    expect(() =>
      simulatePlayoffs(league, run.seasonSeed, undefined, "all", {
        wrong: game,
      }),
    ).toThrow();
  });
  it("rejects overrides beyond replay prefix and missing user qualification", () => {
    const { run, teams, league } = setup();
    const fixture = nextUserPlayoffFixture(league, run.seasonSeed)!;
    const game = officialGameFromArcade(
      finishedGame(fixture, teams),
      fixture,
      teams,
    );
    expect(() =>
      replayPlayoffs(league, run.seasonSeed, 0, { [fixture.id]: game }),
    ).toThrow();
    league.standings[0].wins = 0;
    league.standings[0].losses = 82;
    expect(nextUserPlayoffFixture(league, run.seasonSeed)).toBeNull();
  });
});
