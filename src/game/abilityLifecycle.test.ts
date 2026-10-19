import { abilityTotal } from "./abilities";
import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { createLocalLeague, parseLocalLeague } from "./localLeague";
import { validateLeagueTeams } from "./franchiseValidation";
import { archivedSeasonRun } from "./archive";
import { resolveSeasonMatch } from "./season";
import { resolvePlayoffMatch } from "./playoffs";
import { initialState } from "./state";
import { loadGame, saveGame } from "./persistence";
import type { FranchiseSeason } from "./franchiseTypes";
const run = () => ({
  ...createRun("free", true, 22),
  movesetVersion: undefined,
  abilityMasteryVersion: undefined,
  physicalAbilityVersion: undefined,
  chemistryVersion: undefined,
  chemistryGrowthVersion: undefined,
  moraleVersion: undefined,
  personalityVersion: undefined,
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("enables the same model on all new clubs and CPU regular-season and playoff games", () => {
  const r = run(),
    teams = createLeague(r);
  expect(r.abilityVersion).toBe(1);
  expect(teams.every((t) => t.abilityVersion === 1)).toBe(true);
  expect(
    validateLeagueTeams(teams, true).every((t) => t.abilityVersion === 1),
  ).toBe(true);
  const fixture = {
    id: "cpu",
    round: 0,
    homeTeamId: 2,
    awayTeamId: 3,
    seed: 171,
  };
  const regular = resolveSeasonMatch(fixture, teams);
  expect(
    regular.homeBox.reduce((n, p) => n + abilityTotal(p), 0),
  ).toBeGreaterThan(0);
  expect(resolvePlayoffMatch(fixture, teams)).toEqual(regular);
  const old = createLeague({ ...r, abilityVersion: undefined });
  expect(old.every((t) => t.abilityVersion === undefined)).toBe(true);
  expect(
    resolveSeasonMatch(fixture, old).homeBox.every(
      (p) => !p.abilityActivations,
    ),
  ).toBe(true);
  const mixed = structuredClone(teams);
  delete mixed[1].abilityVersion;
  expect(() => validateLeagueTeams(mixed, true)).toThrow();
  expect(() =>
    validateLeagueTeams(
      teams.map((t) => ({ ...t, abilityVersion: 2 as 1 })),
      true,
    ),
  ).toThrow();
});
it("retains current and historical rule flags through solo saves and archive reconstruction", () => {
  let value = "";
  const storage = {
    getItem: () => value || null,
    setItem: (_key: string, v: string) => {
      value = v;
    },
    removeItem: () => {
      value = "";
    },
  };
  for (const version of [1, undefined] as const) {
    const r = { ...run(), abilityVersion: version },
      state = { ...initialState(22), run: r };
    saveGame(storage, state);
    expect(loadGame(storage, 22).state.run.abilityVersion).toBe(version);
    const teams = createLeague(r);
    const season = {
      seasonSeed: 22,
      replay: { teams, seasonModel: 4 },
    } as FranchiseSeason;
    expect(archivedSeasonRun(season).abilityVersion).toBe(version);
  }
});
it("opts new local leagues in, but never upgrades a saved local career implicitly", () => {
  const d = createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Lee", teamId: 1 },
    ],
    true,
    22,
    2,
  );
  expect(d.abilityVersion).toBe(1);
  expect(parseLocalLeague(JSON.stringify(d)).abilityVersion).toBe(1);
  delete d.physicalAbilityVersion;
  delete d.chemistryVersion;
  delete d.chemistryGrowthVersion;
  delete d.moraleVersion;
  delete d.personalityVersion;
  delete d.movesetVersion;
  delete d.abilityMasteryVersion;
  delete d.abilityVersion;
  expect(parseLocalLeague(JSON.stringify(d)).abilityVersion).toBeUndefined();
  expect(() =>
    parseLocalLeague(JSON.stringify({ ...d, abilityVersion: 2 })),
  ).toThrow();
});

import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { ROSTER_SLOTS } from "./types";
import { startFranchiseSeason } from "./franchise";
import { rookieFixture } from "./rookieDraft.testUtils";

it("adopts abilities at the next solo franchise boundary without rewriting the previous run", () => {
  const state = rookieFixture();
  delete state.run.movesetVersion;
  delete state.run.abilityMasteryVersion;
  delete state.run.abilityVersion;
  state.franchise!.teams.forEach((team) => {
    delete team.movesetVersion;
    delete team.abilityMasteryVersion;
    delete team.abilityMastery;
    delete team.abilityVersion;
  });
  const before = JSON.stringify(state);
  const next = startFranchiseSeason(state, 988);
  expect(next.run.abilityVersion).toBe(1);
  expect(next.franchise!.teams.every((team) => team.abilityVersion === 1)).toBe(
    true,
  );
  expect(JSON.stringify(state)).toBe(before);
});

it("restores old local seasons and adopts abilities only at the next season boundary", () => {
  let draft = local.createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Lee", teamId: 1 },
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
  delete draft.physicalAbilityVersion;
  delete draft.chemistryVersion;
  delete draft.chemistryGrowthVersion;
  delete draft.moraleVersion;
  delete draft.personalityVersion;
  delete draft.movesetVersion;
  delete draft.abilityMasteryVersion;
  delete draft.abilityVersion;
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const mon = local
      .localLeaguePool(draft)
      .find((p) => !draft.picks.some((pick) => pick.pokemonId === p.id))!;
    const slot = ROSTER_SLOTS.find(
      (slot) =>
        !draft.picks.some(
          (pick) => pick.teamId === turn.teamId && pick.slot === slot,
        ),
    )!;
    draft = local.pickLocalPlayer(draft, mon.id, slot);
  }
  const result = simulateLocalSeason(draft);
  const playoffs = simulatePlayoffs(
    result.league!,
    career.localSeasonSeed(draft),
  );
  draft = career.beginLocalOffseason(
    { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
    result,
    playoffs,
  );
  const archived = structuredClone(draft.career!.history);
  const restored = local.parseLocalLeague(JSON.stringify(draft));
  expect(
    restored.career!.teams.every((t) => t.abilityVersion === undefined),
  ).toBe(true);
  const next = career.startNextLocalSeason(restored);
  expect(next.career!.teams.every((t) => t.abilityVersion === 1)).toBe(true);
  expect(next.career!.history).toEqual(archived);
  expect(local.localLeagueRun(next).abilityVersion).toBe(1);
  const roundtrip = local.parseLocalLeague(JSON.stringify(next));
  expect(roundtrip.career!.teams.every((t) => t.abilityVersion === 1)).toBe(
    true,
  );
  // An older already-started year two can still be restored without upgrading it.
  const oldYearTwo = structuredClone(next);
  oldYearTwo.career!.teams.forEach((t) => {
    delete t.movesetVersion;
    delete t.abilityMasteryVersion;
    delete t.abilityMastery;
    delete t.abilityVersion;
    delete t.physicalAbilityVersion;
    delete t.chemistryVersion;
    delete t.chemistryGrowthVersion;
    delete t.moraleVersion;
    delete t.personalityVersion;
    delete t.chemistryBonds;
    delete t.morale;
  });
  expect(
    local
      .parseLocalLeague(JSON.stringify(oldYearTwo))
      .career!.teams.every((t) => t.abilityVersion === undefined),
  ).toBe(true);
  const nextResult = simulateLocalSeason(roundtrip);
  expect(nextResult.league!.players.some((p) => abilityTotal(p) > 0)).toBe(
    true,
  );
  const nextPlayoffs = simulatePlayoffs(
    nextResult.league!,
    career.localSeasonSeed(roundtrip),
  );
  const secondOffseason = career.beginLocalOffseason(
    {
      ...roundtrip,
      completed: true,
      playoffGames: playoffGameCount(nextPlayoffs),
    },
    nextResult,
    nextPlayoffs,
  );
  expect(
    local.parseLocalLeague(JSON.stringify(secondOffseason)).career!.history,
  ).toEqual(secondOffseason.career!.history);
}, 30000);
