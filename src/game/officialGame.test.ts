import { describe, expect, it } from "vitest";
import { createGame } from "./arcade/setup";
import { continuePeriod, stepGame } from "./arcade/engine";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";

import { officialFixture, finishedGame } from "./officialGame.testUtils";
describe("official arcade boxes", () => {
  it.each([false, true])(
    "maps user side to scheduled home/away (%s), scales once and conserves minutes",
    (away) => {
      const { teams, fixture } = officialFixture(away);
      const state = finishedGame(fixture, teams);
      const game = officialGameFromArcade(state, fixture, teams);
      expect(game.courtScore).toEqual(away ? [6, 8] : [8, 6]);
      expect(game.match.homeScore).toBe(game.courtScore[0] * 12);
      expect(game.match.awayScore).toBe(game.courtScore[1] * 12);
      for (const box of [game.match.homeBox, game.match.awayBox]) {
        expect(box.reduce((n, p) => n + p.minutes, 0)).toBe(240);
        expect(box.filter((p) => p.started)).toHaveLength(5);
        expect(box.filter((p) => p.minutes === 0)).toHaveLength(3);
        expect(box.every((p) => p.fta === 0 && p.fouls === 0)).toBe(true);
      }
      expect(validateOfficialGame(game, fixture, teams)).toEqual(game);
    },
  );
  it("uses 25-second official overtime and exact five-minute player extensions", () => {
    const { teams, fixture } = officialFixture();
    const state = finishedGame(fixture, teams, 2);
    const game = officialGameFromArcade(state, fixture, teams);
    expect(game.match.homeBox.reduce((n, p) => n + p.minutes, 0)).toBe(290);
    expect(game.match.overtimePeriods).toBe(2);
    state.phase = "break";
    state.period = 4;
    continuePeriod(state);
    expect(state.clock).toBe(25);
    const exhibition = createGame({
      seed: fixture.seed,
      teams: [teams[0], teams[fixture.awayTeamId]],
    });
    exhibition.phase = "break";
    exhibition.period = 4;
    continuePeriod(exhibition);
    expect(exhibition.clock).toBe(30);
  });
  it("preserves brief appearances when eighth-minute rounding would otherwise erase them", () => {
    const { teams, fixture } = officialFixture();
    const state = finishedGame(fixture, teams);
    state.players[0].stats.seconds -= 0.01;
    state.players[5].stats.seconds = 0.01;
    const game = officialGameFromArcade(state, fixture, teams);
    expect(game.match.homeBox[5].minutes).toBe(0.125);
    expect(game.match.homeBox.reduce((n, p) => n + p.minutes, 0)).toBe(240);
  });
  it("converts a full engine-driven game with exact time, event zones and plus/minus", () => {
    const { teams, fixture } = officialFixture();
    const state = createGame({
      official: true,
      seed: fixture.seed,
      teams: [teams[0], teams[fixture.awayTeamId]],
    });
    for (let tick = 0; tick < 100000 && state.phase !== "final"; tick++) {
      if (state.phase === "break") continuePeriod(state);
      stepGame(state);
    }
    expect(state.phase).toBe("final");
    expect(() => officialGameFromArcade(state, fixture, teams)).not.toThrow();
  });
  it("rejects unfinished games, wrong identities and corrupt official arithmetic", () => {
    const { teams, fixture } = officialFixture();
    const state = finishedGame(fixture, teams);
    state.phase = "live";
    expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
    state.phase = "final";
    const game = officialGameFromArcade(state, fixture, teams);
    expect(() =>
      officialGameFromArcade(
        state,
        { ...fixture, seed: fixture.seed ^ 1 },
        teams,
      ),
    ).toThrow();
    for (const corrupt of [
      (g: typeof game) => (g.fixtureId = "wrong"),
      (g: typeof game) => g.match.homeScore++,
      (g: typeof game) => g.match.homeBox[0].rimFgm++,
      (g: typeof game) => (g.match.homeBox[0].plusMinus += 12),
      (g: typeof game) => (g.match.homeBox[0].minutes -= 0.125),
      (g: typeof game) => (g.match.homeBox[7].points = 12),
    ]) {
      const bad = structuredClone(game);
      corrupt(bad);
      expect(() => validateOfficialGame(bad, fixture, teams)).toThrow();
    }
  });
  it("selects an appeared player when every active player's impact is negative", () => {
    const { teams, fixture } = officialFixture();
    const state = finishedGame(fixture, teams);
    for (const player of state.players.filter(
      (player) => player.stats.seconds > 0,
    ))
      player.stats.turnovers = player.stats.points + 1;
    const game = officialGameFromArcade(state, fixture, teams);
    const winner = [...game.match.homeBox, ...game.match.awayBox].find(
      (player) => player.playerId === game.match.playerOfGameId,
    )!;
    expect(winner.minutes).toBeGreaterThan(0);
  });
  it("reports average per-team possessions for comparison with simulated games", () => {
    const { teams, fixture } = officialFixture();
    const state = finishedGame(fixture, teams);
    const game = officialGameFromArcade(state, fixture, teams);
    const bothTeams = state.players.reduce(
      (sum, player) =>
        sum +
        player.stats.fga +
        player.stats.turnovers -
        player.stats.offensiveRebounds,
      0,
    );
    expect(game.match.possessions).toBe((bothTeams * 12) / 2);
  });
  it("keeps substitutions' actual plus/minus and DNP time", () => {
    const { teams, fixture } = officialFixture();
    const state = finishedGame(fixture, teams);
    expect(state.players[0].stats.plusMinus).toBe(2);
    expect(state.players[7].stats.plusMinus).toBe(0);
    state.phase = "live";
    state.clock = 0.01;
    stepGame(state);
    expect(state.players[7].stats.seconds).toBe(0);
  });
});
