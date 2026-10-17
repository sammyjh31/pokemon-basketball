import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { localSeasonBuilder } from "./localSeason";
import { resolveSeasonMatch } from "./season";
import {
  createPlayoffs,
  simulatePlayoffs,
  replayPlayoffs,
  playoffGameCount,
} from "./playoffs";
import { validateLeagueTeams } from "./franchiseValidation";
import { advanceMorale, snapshotMorale } from "./playerMorale";

const runFixture = () => ({
  ...createRun("free", true, 973),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
const format = {
  teamCount: 4,
  gamesPerTeam: 14,
  playoffTeams: 4,
  bestOf: 1,
} as const;

describe("persistent morale lifecycle", () => {
  it("freezes pregame state, credits actual boxes once, and carries the latest state into playoffs", () => {
    const run = runFixture(),
      allTeams = createLeague(run),
      teams = allTeams.slice(0, 4);
    expect(run.moraleVersion).toBe(1);
    expect(
      allTeams.every(
        (t) => t.moraleVersion === 1 && Object.keys(t.morale!).length === 8,
      ),
    ).toBe(true);
    const before = structuredClone(teams);
    const job = localSeasonBuilder(teams, format, run.seasonSeed);
    const first = job.fixtures[0];
    job.play(first);
    const partial = job.finish().league!;
    const frozen = partial.games[0];
    expect(frozen.morale).toEqual(
      snapshotMorale(teams[first.homeTeamId], teams[first.awayTeamId]),
    );
    const match = resolveSeasonMatch(frozen, teams);
    expect(match.homeScore).toBe(frozen.homeScore);
    expect(partial.morale![first.homeTeamId]).toEqual(
      advanceMorale(
        teams[first.homeTeamId],
        match.homeBox,
        match.homeScore > match.awayScore,
        match.overtimePeriods,
      ),
    );
    expect(match.moraleReport).toBeDefined();
    expect(() => job.play(first)).toThrow();
    job.fixtures.slice(1).forEach(job.play);
    const league = job.finish().league!;
    expect(teams).toEqual(before);
    expect(league.teams).toEqual(before);
    expect(
      Object.values(league.morale![0]).every((value) => value.games === 14),
    ).toBe(true);
    expect(createPlayoffs(league, run.seasonSeed).morale).toEqual(
      league.morale,
    );
    const playoffs = simulatePlayoffs(league, run.seasonSeed);
    expect(
      replayPlayoffs(league, run.seasonSeed, playoffGameCount(playoffs)),
    ).toEqual(playoffs);
    expect(
      Object.values(playoffs.morale![playoffs.championId!]).every(
        (value) => value.games === 16,
      ),
    ).toBe(true);
  });

  it("requires matching version flags and exactly the current roster state", () => {
    const teams = createLeague(runFixture());
    expect(() => validateLeagueTeams(teams, true)).not.toThrow();
    const mixed = structuredClone(teams);
    delete mixed[1].moraleVersion;
    expect(() => validateLeagueTeams(mixed, true)).toThrow();
    const bad = structuredClone(teams);
    bad[0].morale![999999] = {
      score: 50,
      minutes: 0,
      success: 50,
      disruption: 0,
      games: 0,
    };
    expect(() => validateLeagueTeams(bad, true)).toThrow();
    const noGrowth = runFixture();
    delete noGrowth.chemistryGrowthVersion;
    expect(() => createLeague(noGrowth)).toThrow();
  });
});

it("applies rookie adaptation exactly once while keeping eight species-owned records", async () => {
  const { rookieFixture } = await import("./rookieDraft.testUtils");
  const { beginRookieDraft, selectRookie } = await import("./rookieDraft");
  const { retainMorale } = await import("./playerMorale");
  const state = rookieFixture();
  state.franchise!.teams = state.franchise!.teams.map((team) =>
    retainMorale({
      ...team,
      chemistryVersion: 1 as const,
      chemistryGrowthVersion: 1 as const,
      chemistryBonds: {},
    }),
  );
  const before = structuredClone(state);
  const next = selectRookie(beginRookieDraft(state), 252, 129);
  const user = next.franchise!.teams[0];
  expect(user.roster.PG).toBe(252);
  expect(user.morale![252]).toEqual({
    score: 50,
    minutes: 0,
    success: 50,
    disruption: -4,
    games: 0,
  });
  expect(user.morale![25]).toEqual({
    score: 49.5,
    minutes: 0,
    success: 50,
    disruption: -1,
    games: 0,
  });
  expect(user.morale![129]).toBeUndefined();
  expect(
    next.franchise!.teams.every(
      (team) => Object.keys(team.morale!).length === 8,
    ),
  ).toBe(true);
  expect(state).toEqual(before);
});
