import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { validateLeagueTeams } from "./franchiseValidation";
import { archivedSeasonRun } from "./archive";
import { initialState } from "./state";
import { loadGame, saveGame } from "./persistence";
import { startFranchiseSeason } from "./franchise";
import { rookieFixture } from "./rookieDraft.testUtils";
import type { FranchiseSeason } from "./franchiseTypes";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { ROSTER_SLOTS } from "./types";

const run = () => ({
  ...createRun("free", true, 22),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("opts new solo and local clubs into one chemistry version, rejecting mixed and unknown flags", () => {
  const r = run(),
    teams = createLeague(r);
  expect(r.chemistryVersion).toBe(1);
  expect(
    validateLeagueTeams(teams, true).every((t) => t.chemistryVersion === 1),
  ).toBe(true);
  expect(
    validateLeagueTeams(
      teams.map((team) => ({
        ...team,
        abilityVersion: undefined,
        physicalAbilityVersion: undefined,
        engineRules: {
          version: 1,
          abilities: false,
          adaptiveCoaching: false,
          familiarity: 0,
        },
      })),
      true,
    ).every((team) => team.chemistryVersion === 1),
  ).toBe(true);
  const mixed = structuredClone(teams);
  delete mixed[1].chemistryVersion;
  expect(() => validateLeagueTeams(mixed, true)).toThrow();
  expect(() =>
    validateLeagueTeams(
      teams.map((t) => ({ ...t, chemistryVersion: 2 })),
      true,
    ),
  ).toThrow();
  const draft = local.createLocalLeague(
    [
      { name: "A", teamId: 0 },
      { name: "B", teamId: 1 },
    ],
    true,
    22,
  );
  expect(draft.chemistryVersion).toBe(1);
  expect(local.parseLocalLeague(JSON.stringify(draft)).chemistryVersion).toBe(
    1,
  );
  expect(
    local.parseLocalLeague(
      JSON.stringify({
        ...draft,
        abilityVersion: undefined,
        physicalAbilityVersion: undefined,
      }),
    ).chemistryVersion,
  ).toBe(1);
  delete draft.chemistryVersion;
  delete draft.chemistryGrowthVersion;
  expect(
    local.parseLocalLeague(JSON.stringify(draft)).chemistryVersion,
  ).toBeUndefined();
  expect(() =>
    local.parseLocalLeague(JSON.stringify({ ...draft, chemistryVersion: 2 })),
  ).toThrow();
});
it("preserves absent chemistry flags through saves and archives and rejects invalid saved versions", () => {
  let value = "";
  const storage = {
    getItem: () => value || null,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    removeItem: () => {
      value = "";
    },
  };
  for (const version of [1, undefined] as const) {
    const r = {
      ...run(),
      chemistryVersion: version,
      chemistryGrowthVersion: undefined,
    };
    saveGame(storage, { ...initialState(22), run: r });
    const loaded = loadGame(storage, 22);
    expect(loaded.notice).toBeNull();
    expect(loaded.state.run.chemistryVersion).toBe(version);
    const season = {
      seasonSeed: 22,
      replay: { teams: createLeague(r), seasonModel: 4 },
    } as FranchiseSeason;
    expect(archivedSeasonRun(season).chemistryVersion).toBe(version);
  }
  const bad = JSON.parse(value);
  bad.run.chemistryVersion = 2;
  value = JSON.stringify(bad);
  expect(loadGame(storage, 22).notice).toBeTruthy();
  bad.run.chemistryVersion = 1;
  delete bad.run.abilityVersion;
  delete bad.run.physicalAbilityVersion;
  value = JSON.stringify(bad);
  expect(loadGame(storage, 22).notice).toBeNull();
});
it("adopts chemistry only at the next solo franchise boundary", () => {
  const state = rookieFixture();
  delete state.run.chemistryVersion;
  state.franchise!.teams.forEach((t) => delete t.chemistryVersion);
  const before = JSON.stringify(state),
    next = startFranchiseSeason(state, 988);
  expect(next.run.chemistryVersion).toBe(1);
  expect(next.franchise!.teams.every((t) => t.chemistryVersion === 1)).toBe(
    true,
  );
  expect(JSON.stringify(state)).toBe(before);
});
it("restores historical local chemistry per season without rewriting the original draft", () => {
  let draft = local.createLocalLeague(
    [
      { name: "A", teamId: 0 },
      { name: "B", teamId: 1 },
    ],
    true,
    601,
    2,
    {
      mode: "full-pool",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: true,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    },
  );
  delete draft.chemistryVersion;
  delete draft.chemistryGrowthVersion;
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const id = local
      .localLeaguePool(draft)
      .find((p) => !draft.picks.some((x) => x.pokemonId === p.id))!.id;
    const slot = ROSTER_SLOTS.find(
      (s) => !draft.picks.some((p) => p.teamId === turn.teamId && p.slot === s),
    )!;
    draft = local.pickLocalPlayer(draft, id, slot);
  }
  const finish = (d: local.LocalLeague) => {
    const result = simulateLocalSeason(d),
      playoffs = simulatePlayoffs(result.league!, career.localSeasonSeed(d));
    return career.beginLocalOffseason(
      { ...d, completed: true, playoffGames: playoffGameCount(playoffs) },
      result,
      playoffs,
    );
  };
  const old = finish(draft),
    archived = structuredClone(old.career!.history);
  const restored = local.parseLocalLeague(JSON.stringify(old));
  expect(
    restored.career!.teams.every((t) => t.chemistryVersion === undefined),
  ).toBe(true);
  const next = career.startNextLocalSeason(restored);
  expect(next.chemistryVersion).toBeUndefined();
  expect(local.localLeagueRun(next).chemistryVersion).toBe(1);
  expect(next.career!.history).toEqual(archived);
  expect(
    local
      .parseLocalLeague(JSON.stringify(next))
      .career!.teams.every((t) => t.chemistryVersion === 1),
  ).toBe(true);
  const historicSecond = structuredClone(next);
  historicSecond.career!.teams.forEach((t) => {
    delete t.chemistryVersion;
    delete t.chemistryGrowthVersion;
    delete t.chemistryBonds;
  });
  expect(
    local
      .parseLocalLeague(JSON.stringify(historicSecond))
      .career!.teams.every((t) => t.chemistryVersion === undefined),
  ).toBe(true);
  const second = finish(next);
  expect(
    second.career!.history[0].teams.every(
      (team) => team.chemistryVersion === undefined,
    ),
  ).toBe(true);
  expect(
    second.career!.history[1].teams.every(
      (team) => team.chemistryVersion === 1,
    ),
  ).toBe(true);
  expect(
    local.parseLocalLeague(JSON.stringify(second)).career!.history,
  ).toEqual(second.career!.history);
  const mixed = structuredClone(second);
  delete mixed.career!.teams[1].chemistryVersion;
  expect(() => local.parseLocalLeague(JSON.stringify(mixed))).toThrow();
  const mixedArchive = structuredClone(second);
  delete mixedArchive.career!.history[1].teams[1].chemistryVersion;
  expect(() => local.parseLocalLeague(JSON.stringify(mixedArchive))).toThrow();
  const invalid = structuredClone(second);
  invalid.career!.teams.forEach((team) =>
    Object.assign(team, { chemistryVersion: 2 }),
  );
  expect(() => local.parseLocalLeague(JSON.stringify(invalid))).toThrow();
}, 30000);
