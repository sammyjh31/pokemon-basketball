import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { initialState } from "./state";
import { loadGame, type StorageLike } from "./persistence";
import { createLeague } from "./league";
import {
  createLocalLeague,
  parseLocalLeague,
  localLeagueTeams,
} from "./localLeague";
import { validateLeagueTeams } from "./franchiseValidation";
import { archivedSeasonRun } from "./archive";
import { ROSTER_SLOTS } from "./types";
import { rookieFixture } from "./rookieDraft.testUtils";
import { startFranchiseSeason } from "./franchise";
import { exchangePlayers } from "./rosterTrades";
import { isShinyPokemon } from "./shiny";
import { teamRatings } from "./ratings";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import {
  beginLocalOffseason,
  localSeasonSeed,
  startNextLocalSeason,
} from "./localCareer";

const memory = (value: unknown): StorageLike => ({
  getItem: () => JSON.stringify(value),
  setItem: () => {},
});
const managers = [
  { name: "Sam", teamId: 0 },
  { name: "Alex", teamId: 1 },
];
const drafted = () => {
  const run = createRun("free", true, 81);
  ROSTER_SLOTS.forEach((slot, index) => {
    run.roster[slot] = index + 1;
  });
  return run;
};

describe("persistent league shiny identity", () => {
  it("retains the opening identity across a new solo year and player exchanges without storing a development bonus", () => {
    const state = rookieFixture();
    let shinySeed = 0;
    const id = state.franchise!.teams[0].roster.PG!;
    while (!isShinyPokemon(id, shinySeed)) shinySeed++;
    state.run.shinySeed = shinySeed;
    state.franchise!.shinySeed = shinySeed;
    state.franchise!.teams = state.franchise!.teams.map((team) => ({
      ...team,
      shinySeed,
    }));
    const next = startFranchiseSeason(state, 701);
    expect(next.run.seasonSeed).not.toBe(state.run.seasonSeed);
    expect(next.run.shinySeed).toBe(shinySeed);
    expect(next.franchise!.shinySeed).toBe(shinySeed);
    expect(
      next.run.leagueTeams!.every((team) => team.shinySeed === shinySeed),
    ).toBe(true);
    const teams = next.run.leagueTeams!;
    const receivedId = teams[1].roster.PG!;
    const exchanged = exchangePlayers(teams, 0, 1, id, receivedId);
    expect(exchanged[1].shinySeed).toBe(shinySeed);
    expect(exchanged[1].development?.[id]).toBeUndefined();
    expect(exchanged[1].ratings).toEqual(
      teamRatings(
        exchanged[1].roster,
        exchanged[1].tactic,
        exchanged[1].rotation,
        exchanged[1].development,
        exchanged[1].rotationPlan,
        shinySeed,
      ),
    );
    const legacy = startFranchiseSeason(rookieFixture(), 701);
    expect(legacy.run).not.toHaveProperty("shinySeed");
    expect(
      legacy.franchise!.teams.every((team) => team.shinySeed === undefined),
    ).toBe(true);
  });
  it("retains local identity in offseason, archived inputs, next year, and a loaded career", () => {
    let draft = createLocalLeague(managers, true, 81, 2, {
      mode: "full-pool",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: true,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    });
    draft.picks = Array.from({ length: 32 }, (_, i) => ({
      teamId: (Math.floor(i / 4) % 2
        ? [...draft.order].reverse()
        : draft.order)[i % 4],
      pokemonId: i + 1,
      slot: ROSTER_SLOTS[Math.floor(i / 4)],
    }));
    const result = simulateLocalSeason(draft);
    const playoffs = simulatePlayoffs(result.league!, localSeasonSeed(draft));
    draft = beginLocalOffseason(
      { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
      result,
      playoffs,
    );
    const openingSeed = draft.shinySeed;
    expect(
      draft.career!.history[0].teams.every(
        (team) => team.shinySeed === openingSeed,
      ),
    ).toBe(true);
    const next = startNextLocalSeason(draft);
    expect(next.shinySeed).toBe(openingSeed);
    expect(
      next.career!.teams.every((team) => team.shinySeed === openingSeed),
    ).toBe(true);
    expect(parseLocalLeague(JSON.stringify(next))).toEqual(next);
    const corrupted = structuredClone(next);
    corrupted.career!.history[0].teams[1].shinySeed = openingSeed! ^ 1;
    expect(() => parseLocalLeague(JSON.stringify(corrupted))).toThrow();
  }, 120000);
  it("derives the same fixed seed for solo and local leagues from their opening seed", () => {
    const solo = createRun("free", true, 81);
    const local = createLocalLeague(managers, true, 81);
    expect(solo.shinySeed).toBeTypeOf("number");
    expect(local.shinySeed).toBe(solo.shinySeed);
    expect(createRun("spin", false, 81).shinySeed).toBe(solo.shinySeed);
    expect(createRun("spin", false, 82).shinySeed).not.toBe(solo.shinySeed);
  });
  it("round trips a draft seed and leaves historical saves without the feature", () => {
    const state = initialState(81);
    const loaded = loadGame(memory(state), 900);
    expect(loaded.notice).toBeNull();
    expect(loaded.state.run.shinySeed).toBe(state.run.shinySeed);
    delete state.run.shinySeed;
    expect(loadGame(memory(state), 900).state.run).not.toHaveProperty(
      "shinySeed",
    );
    const local = createLocalLeague(managers, true, 81);
    expect(parseLocalLeague(JSON.stringify(local)).shinySeed).toBe(
      local.shinySeed,
    );
    delete local.shinySeed;
    expect(parseLocalLeague(JSON.stringify(local))).not.toHaveProperty(
      "shinySeed",
    );
  });
  it.each([-1, 0x100000000, 1.5, null, "81"])(
    "rejects invalid saved seeds: %s",
    (value) => {
      const state = initialState(81);
      Object.assign(state.run, { shinySeed: value });
      expect(loadGame(memory(state), 900).notice).not.toBeNull();
      const local = createLocalLeague(managers, true, 81);
      Object.assign(local, { shinySeed: value });
      expect(() => parseLocalLeague(JSON.stringify(local))).toThrow();
    },
  );
  it("propagates and reconstructs one shared seed for every solo team, rejecting mixed identities", () => {
    const run = drafted();
    const teams = createLeague(run);
    expect(teams.every((team) => team.shinySeed === run.shinySeed)).toBe(true);
    expect(validateLeagueTeams(teams, true)).toEqual(teams);
    teams[1].shinySeed = teams[1].shinySeed! ^ 1;
    expect(() => validateLeagueTeams(teams, true)).toThrow();
  });
  it("propagates seed to all locally drafted clubs", () => {
    const draft = createLocalLeague(managers, true, 81);
    draft.picks = Array.from({ length: 240 }, (_, i) => ({
      teamId: Math.floor(i / 8),
      pokemonId: i + 1,
      slot: ROSTER_SLOTS[i % 8],
    }));
    expect(
      localLeagueTeams(draft).every(
        (team) => team.shinySeed === draft.shinySeed,
      ),
    ).toBe(true);
  });
  it("restores archived seed exclusively from the frozen team inputs", () => {
    const teams = createLeague(drafted());
    const run = archivedSeasonRun({
      seasonSeed: 7,
      replay: { teams, seasonModel: 6, playedGames: {} },
    } as Parameters<typeof archivedSeasonRun>[0]);
    expect(run.shinySeed).toBe(teams[0].shinySeed);
    teams.forEach((team) => {
      delete team.shinySeed;
    });
    const old = archivedSeasonRun({
      seasonSeed: 7,
      replay: { teams, seasonModel: 6, playedGames: {} },
    } as Parameters<typeof archivedSeasonRun>[0]);
    expect(old).not.toHaveProperty("shinySeed");
  });
});
