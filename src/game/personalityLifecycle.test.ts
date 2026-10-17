import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { startFranchiseSeason } from "./franchise";
import { archivedSeasonRun } from "./archive";
import { rookieFixture } from "./rookieDraft.testUtils";
import type { FranchiseSeason } from "./franchiseTypes";
import { createLeague } from "./league";
import { validateLeagueTeams } from "./franchiseValidation";
import { initialState } from "./state";
import { loadGame } from "./persistence";
import { createLocalLeague, parseLocalLeague } from "./localLeague";
import type { LocalLeagueOptions } from "./localFormat";

const options: LocalLeagueOptions = {
  mode: "generational",
  format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
  engineRules: {
    version: 1,
    abilities: true,
    adaptiveCoaching: true,
    familiarity: 0,
  },
};
const restoreLocalLeague = (value: unknown) =>
  parseLocalLeague(JSON.stringify(value));
const runFixture = () => ({
  ...createRun("free", true, 973),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});

describe("personality lifecycle versions", () => {
  it("enables new drafts, preserves old drafts, and rejects unsupported or dependency-free saved flags", () => {
    const state = initialState(973);
    expect(state.run.personalityVersion).toBe(1);
    const restore = (raw: unknown) =>
      loadGame({ getItem: () => JSON.stringify(raw), setItem: () => {} }, 7);
    expect(restore(state).state).toEqual(state);
    const legacy = structuredClone(state);
    delete legacy.run.personalityVersion;
    expect(restore(legacy).state).toEqual(legacy);
    for (const raw of [
      { ...state, run: { ...state.run, personalityVersion: 2 } },
      { ...state, run: { ...state.run, moraleVersion: undefined } },
    ])
      expect(restore(raw).notice).toBeTruthy();
  });

  it("carries matching flags to every club and rejects mixed teams", () => {
    const run = runFixture();
    const teams = createLeague(run);
    expect(teams.every((team) => team.personalityVersion === 1)).toBe(true);
    expect(validateLeagueTeams(teams, true)).toEqual(teams);
    const mixed = structuredClone(teams);
    delete mixed[1].personalityVersion;
    expect(() => validateLeagueTeams(mixed, true)).toThrow();
    expect(() => createLeague({ ...run, moraleVersion: undefined })).toThrow();
    delete run.personalityVersion;
    expect(
      createLeague(run).every((team) => team.personalityVersion === undefined),
    ).toBe(true);
  });

  it("round-trips current and legacy local drafts while validating personality dependencies", () => {
    const draft = createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Alex", teamId: 1 },
      ],
      true,
      29,
      2,
      options,
    );
    expect(draft.personalityVersion).toBe(1);
    expect(restoreLocalLeague(draft)).toEqual(draft);
    const legacy = structuredClone(draft);
    delete legacy.personalityVersion;
    expect(restoreLocalLeague(legacy)).toEqual(legacy);
    expect(() =>
      restoreLocalLeague({ ...draft, personalityVersion: 2 }),
    ).toThrow();
    expect(() =>
      restoreLocalLeague({ ...draft, moraleVersion: undefined }),
    ).toThrow();
  });
});

it("enables personalities only when an old solo franchise starts its next season", () => {
  const old = rookieFixture();
  const before = structuredClone(old);
  const next = startFranchiseSeason(old, 987);
  expect(next.franchise!.year).toBe(2);
  expect(next.run.personalityVersion).toBe(1);
  expect(
    next.franchise!.teams.every(
      (team) => team.personalityVersion === 1 && team.moraleVersion === 1,
    ),
  ).toBe(true);
  expect(old).toEqual(before);
  expect(next.franchise!.history).toEqual(old.franchise!.history);
});

it("reconstructs the archive personality rules from frozen clubs", () => {
  const teams = createLeague(runFixture());
  const season = {
    seasonSeed: 973,
    replay: { seasonModel: 5, teams },
  } as unknown as FranchiseSeason;
  expect(archivedSeasonRun(season).personalityVersion).toBe(1);
  teams.forEach((team) => delete team.personalityVersion);
  expect(archivedSeasonRun(season).personalityVersion).toBeUndefined();
});
