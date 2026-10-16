import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { createLocalLeague, parseLocalLeague } from "./localLeague";
import { validateLeagueTeams } from "./franchiseValidation";
import { archivedSeasonRun } from "./archive";
import type { FranchiseSeason } from "./franchiseTypes";
const run = () => ({
  ...createRun("free", true, 22),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("opts new runs and all clubs in, validates the version and freezes archive rules", () => {
  const r = run(),
    teams = createLeague(r);
  expect(r.possessionVersion).toBe(1);
  expect(teams.every((t) => t.possessionVersion === 1)).toBe(true);
  expect(
    validateLeagueTeams(teams, true).map((t) => t.possessionVersion),
  ).toEqual(Array(30).fill(1));
  const season = {
    seasonSeed: 22,
    replay: { teams, seasonModel: 4 },
  } as FranchiseSeason;
  expect(archivedSeasonRun(season).possessionVersion).toBe(1);
  const old = createLeague({ ...r, possessionVersion: undefined });
  expect(old.every((t) => t.possessionVersion === undefined)).toBe(true);
  expect(
    archivedSeasonRun({ ...season, replay: { ...season.replay!, teams: old } })
      .possessionVersion,
  ).toBeUndefined();
  const mixed = structuredClone(teams);
  delete mixed[1].possessionVersion;
  expect(() => validateLeagueTeams(mixed, true)).toThrow();
  const invalid = teams.map((t) => ({ ...t, possessionVersion: 2 as 1 }));
  expect(() => validateLeagueTeams(invalid, true)).toThrow();
});
it("new local leagues opt in but loading historical local inputs never adds a version", () => {
  const draft = createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Lee", teamId: 1 },
    ],
    true,
    22,
    2,
  );
  expect(draft.possessionVersion).toBe(1);
  expect(parseLocalLeague(JSON.stringify(draft)).possessionVersion).toBe(1);
  delete draft.possessionVersion;
  expect(
    parseLocalLeague(JSON.stringify(draft)).possessionVersion,
  ).toBeUndefined();
  expect(() =>
    parseLocalLeague(JSON.stringify({ ...draft, possessionVersion: 2 })),
  ).toThrow();
});
