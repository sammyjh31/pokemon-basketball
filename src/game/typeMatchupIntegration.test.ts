import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import {
  createLocalLeague,
  localLeagueTeams,
  parseLocalLeague,
} from "./localLeague";
import { initialState } from "./state";
import { loadGame } from "./persistence";
import { validateLeagueTeams } from "./franchiseValidation";
const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
it("enables type interactions for new runs and retains their version through saves", () => {
  const state = initialState(42);
  expect(state.run.typeMatchupsVersion).toBe(1);
  expect(
    loadGame({ getItem: () => JSON.stringify(state), setItem: () => {} }, 1)
      .state,
  ).toEqual(state);
  const teams = createLeague({ ...createRun("free", false, 42), roster });
  expect(teams.every((t) => t.typeMatchupsVersion === 1)).toBe(true);
  expect(
    validateLeagueTeams(teams, false).map((t) => t.typeMatchupsVersion),
  ).toEqual(Array(30).fill(1));
  const legacy = structuredClone(state);
  delete legacy.run.typeMatchupsVersion;
  delete legacy.run.matchupVersion;
  delete legacy.run.typeTacticsVersion;
  expect(
    loadGame({ getItem: () => JSON.stringify(legacy), setItem: () => {} }, 1)
      .state.run.typeMatchupsVersion,
  ).toBeUndefined();
});
it("replays local leagues using the type rules they were saved with", () => {
  const draft = createLocalLeague(
    [
      { name: "Sam", teamId: 0 },
      { name: "Alex", teamId: 1 },
    ],
    false,
    42,
  );
  expect(draft.typeMatchupsVersion).toBe(1);
  expect(parseLocalLeague(JSON.stringify(draft)).typeMatchupsVersion).toBe(1);
  expect(
    localLeagueTeams(draft).every((t) => t.typeMatchupsVersion === 1),
  ).toBe(true);
  delete draft.typeMatchupsVersion;
  delete draft.matchupVersion;
  delete draft.typeTacticsVersion;
  const old = parseLocalLeague(JSON.stringify(draft));
  expect(old.typeMatchupsVersion).toBeUndefined();
  expect(
    localLeagueTeams(old).every((t) => t.typeMatchupsVersion === undefined),
  ).toBe(true);
});
it("changes seeded possessions and records genuine opportunities without breaking box scores", () => {
  const teams = createLeague({ ...createRun("free", false, 42), roster });
  // Pin this regression to the original typing layer; deeper assignment tactics
  // deliberately remove some of the favorable matchups asserted below.
  for (const team of teams) delete team.matchupVersion;
  for (const team of teams) delete team.typeTacticsVersion;
  const result = simulateMatch(teams[0], teams[1], 123);
  expect(result.typeMatchups).toBeDefined();
  expect(result.typeMatchups!.home.counterSubstitutions).toBeGreaterThan(0);
  expect(result.typeMatchups!.away.counterSubstitutions).toBeGreaterThan(0);
  expect(result.homeBox.filter((p) => p.started)).toHaveLength(5);
  expect(result.awayBox.filter((p) => p.started)).toHaveLength(5);
  expect(result).toEqual(simulateMatch(teams[0], teams[1], 123));
  const oldTeams = teams.map((t) => {
    const old = { ...t };
    delete old.typeMatchupsVersion;
    delete old.matchupVersion;
    delete old.typeTacticsVersion;
    return old;
  });
  const old = simulateMatch(oldTeams[0], oldTeams[1], 123);
  expect(result.homeBox).not.toEqual(old.homeBox);
  expect(old.typeMatchups).toBeUndefined();
  for (const [side, box, score] of [
    ["home", result.homeBox, result.homeScore],
    ["away", result.awayBox, result.awayScore],
  ] as const) {
    const report = result.typeMatchups![side];
    expect(
      report.advantaged + report.resisted + report.neutral,
    ).toBeGreaterThan(0);
    expect(report.advantaged).toBeGreaterThan(0);
    expect(report.resisted).toBeGreaterThan(0);
    expect(box.reduce((n, p) => n + p.points, 0)).toBe(score);
    expect(box.reduce((n, p) => n + p.minutes, 0)).toBe(
      240 + 25 * result.overtimePeriods,
    );
  }
  expect(() => simulateMatch(teams[0], oldTeams[1], 123)).toThrow(/type/i);
});
it("rejects mixed or unknown saved type rules", () => {
  const teams = createLeague({ ...createRun("free", false, 42), roster });
  delete teams[1].typeMatchupsVersion;
  expect(() => validateLeagueTeams(teams, false)).toThrow();
  const state = initialState(42);
  const broken = { ...state, run: { ...state.run, typeMatchupsVersion: 99 } };
  expect(
    loadGame({ getItem: () => JSON.stringify(broken), setItem: () => {} }, 1)
      .notice,
  ).not.toBeNull();
});
