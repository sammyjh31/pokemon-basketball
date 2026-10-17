import { pairKey } from "./teammateChemistry";
import { describe, expect, it } from "vitest";
import { createGame } from "./arcade/setup";
import { continuePeriod, stepGame } from "./arcade/engine";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";

import { officialFixture, finishedGame } from "./officialGame.testUtils";
describe("official arcade boxes", () => {
  it("preserves actual ability activations without multiplying them by the official score scale", () => {
    const { teams, fixture } = officialFixture();
    teams[0].abilityVersion = 1;
    const state = finishedGame(fixture, teams);
    state.abilityVersion = 1;
    for (const player of state.players)
      player.stats.abilityActivations = { offense: 0, support: 0, defense: 0 };
    state.players[0].stats.abilityActivations!.offense = 4;
    state.players[1].stats.abilityActivations!.support = 2;
    state.players[8].stats.abilityActivations!.defense = 3;
    const game = officialGameFromArcade(state, fixture, teams);
    expect(game.abilityVersion).toBe(1);
    expect(game.match.homeBox[0].fga).toBe(48);
    expect(game.match.homeBox[0].abilityActivations?.offense).toBe(4);
    expect(game.match.homeBox[1].abilityActivations?.support).toBe(2);
    expect(game.match.awayBox[0].abilityActivations?.defense).toBe(3);
    expect(
      validateOfficialGame(JSON.parse(JSON.stringify(game)), fixture, teams),
    ).toEqual(game);
    for (const corrupt of [
      (g: typeof game) => {
        (g as { abilityVersion?: number }).abilityVersion = 2;
      },
      (g: typeof game) => {
        delete g.match.homeBox[0].abilityActivations;
      },
      (g: typeof game) => {
        g.match.homeBox[0].abilityActivations!.offense = 5;
      },
      (g: typeof game) => {
        g.match.homeBox[0].abilityActivations!.offense = 0.5;
      },
      (g: typeof game) => {
        g.match.homeBox[1].abilityActivations!.support = 5;
      },
      (g: typeof game) => {
        g.match.homeBox[7].abilityActivations!.support = 1;
      },
      (g: typeof game) => {
        g.match.awayBox[1].abilityActivations!.defense = 2;
      },
      (g: typeof game) => {
        delete g.abilityVersion;
      },
    ]) {
      const bad = structuredClone(game);
      corrupt(bad);
      expect(() => validateOfficialGame(bad, fixture, teams)).toThrow();
    }
    teams[0].engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: true,
      familiarity: 0,
    };
    expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
    expect(() => validateOfficialGame(game, fixture, teams)).toThrow();
  });
  it("keeps historical official games without the ability version or statistics valid", () => {
    const { teams, fixture } = officialFixture();
    for (const team of teams) {
      delete team.abilityVersion;
      delete team.physicalAbilityVersion;
    }
    const state = finishedGame(fixture, teams);
    const game = officialGameFromArcade(state, fixture, teams);
    expect(game).not.toHaveProperty("abilityVersion");
    expect(game.match.homeBox[0]).not.toHaveProperty("abilityActivations");
    expect(validateOfficialGame(game, fixture, teams)).toEqual(game);
    teams[0].abilityVersion = 1;
    expect(() => validateOfficialGame(game, fixture, teams)).toThrow();
    expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
  });
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
  it.each([false, true])(
    "converts a full engine-driven game with exact time, event zones and plus/minus (abilities %s)",
    (enabled) => {
      const { teams, fixture } = officialFixture();
      if (enabled) teams[0].abilityVersion = 1;
      else
        for (const team of teams) {
          delete team.abilityVersion;
          delete team.physicalAbilityVersion;
        }
      const state = createGame({
        official: true,
        chemistryVersion: 1,
        chemistryGrowthVersion: 1,
        ...(enabled
          ? { abilityVersion: 1 as const, physicalAbilityVersion: 1 as const }
          : {}),
        seed: fixture.seed,
        teams: [teams[0], teams[fixture.awayTeamId]],
      });
      for (let tick = 0; tick < 100000 && state.phase !== "final"; tick++) {
        if (state.phase === "break") continuePeriod(state);
        stepGame(state);
      }
      expect(state.phase).toBe("final");
      expect(() => officialGameFromArcade(state, fixture, teams)).not.toThrow();
    },
  );
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
      (g: typeof game) =>
        (g.match.chemistryMinutes!.home[
          pairKey(g.match.homeBox[0].pokemonId, g.match.homeBox[7].pokemonId)
        ] = 0.01),
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
