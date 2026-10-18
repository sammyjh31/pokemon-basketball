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
import { COURT_VERSION } from "./courtTypes";
const run = () => ({
  ...createRun("free", true, 22),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("enables the same model on all new clubs and CPU regular-season and playoff games", () => {
  const r = run(),
    teams = createLeague(r);
  expect(r.courtVersion).toBe(COURT_VERSION);
  expect(teams.every((t) => t.courtVersion === COURT_VERSION)).toBe(true);
  expect(
    validateLeagueTeams(teams, true).every(
      (t) => t.courtVersion === COURT_VERSION,
    ),
  ).toBe(true);
  const fixture = {
    id: "cpu",
    round: 0,
    homeTeamId: 2,
    awayTeamId: 3,
    seed: 171,
  };
  const regular = resolveSeasonMatch(fixture, teams);
  expect(regular.insights!.court!.length).toBeGreaterThan(100);
  expect(resolvePlayoffMatch(fixture, teams)).toEqual(regular);
  const old = createLeague({
    ...r,
    courtVersion: undefined,
    gameFlowVersion: undefined,
  });
  expect(old.every((t) => t.courtVersion === undefined)).toBe(true);
  expect(resolveSeasonMatch(fixture, old).insights!.court).toBeUndefined();
  const mixed = structuredClone(teams);
  delete mixed[1].courtVersion;
  expect(() => validateLeagueTeams(mixed, true)).toThrow();
  expect(() =>
    validateLeagueTeams(
      teams.map((t) => ({ ...t, courtVersion: 4 as 3 })),
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
  for (const version of [3, 2, 1, undefined] as const) {
    const r = {
        ...run(),
        courtVersion: version,
        ...(version === undefined ? { gameFlowVersion: undefined } : {}),
      },
      state = { ...initialState(22), run: r };
    saveGame(storage, state);
    expect(loadGame(storage, 22).state.run.courtVersion).toBe(version);
    const teams = createLeague(r);
    const season = {
      seasonSeed: 22,
      replay: { teams, seasonModel: 4 },
    } as FranchiseSeason;
    expect(archivedSeasonRun(season).courtVersion).toBe(version);
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
  expect(d.courtVersion).toBe(COURT_VERSION);
  expect(parseLocalLeague(JSON.stringify(d)).courtVersion).toBe(COURT_VERSION);
  expect(
    parseLocalLeague(JSON.stringify({ ...d, courtVersion: 2 })).courtVersion,
  ).toBe(2);
  expect(
    parseLocalLeague(JSON.stringify({ ...d, courtVersion: 1 })).courtVersion,
  ).toBe(1);
  delete d.courtVersion;
  delete d.gameFlowVersion;
  expect(parseLocalLeague(JSON.stringify(d)).courtVersion).toBeUndefined();
  expect(() =>
    parseLocalLeague(JSON.stringify({ ...d, courtVersion: 4 })),
  ).toThrow();
});
