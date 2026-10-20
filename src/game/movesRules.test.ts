import { expect, it } from "vitest";
import { initialState } from "./state";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { validateLeagueTeams } from "./franchiseValidation";
import {
  createLocalLeague,
  parseLocalLeague,
  localLeagueTeams,
} from "./localLeague";
import { loadGame } from "./persistence";
it("enables the shared moves rules for new solo and both local draft formats", () => {
  expect(initialState(55).run.movesetVersion).toBe(2);
  for (const mode of ["generational", "full-pool"] as const) {
    const draft = createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Alex", teamId: 1 },
      ],
      true,
      55,
      2,
      {
        mode,
        format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
        engineRules: {
          version: 1,
          abilities: true,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      },
    );
    expect(draft.movesetVersion).toBe(2);
    expect(parseLocalLeague(JSON.stringify(draft)).movesetVersion).toBe(2);
  }
});
it("propagates the rule to every CPU club and retains it through team validation", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 1 });
  expect(teams.every((t) => t.movesetVersion === 1)).toBe(true);
  expect(
    validateLeagueTeams(teams, true).every((t) => t.movesetVersion === 1),
  ).toBe(true);
  const mixed = structuredClone(teams);
  delete mixed[5].movesetVersion;
  expect(() => validateLeagueTeams(mixed, true)).toThrow();
});
it("preserves omitted rules in older solo/local saves and refuses invalid opt-in combinations", () => {
  const state = initialState(55);
  delete state.run.movesetVersion;
  const restored = loadGame(
    { getItem: () => JSON.stringify(state), setItem: () => {} },
    55,
  );
  expect(restored.notice).toBeNull();
  expect(restored.state.run.movesetVersion).toBeUndefined();
  const bad = { ...state, run: { ...state.run, movesetVersion: 7 } };
  expect(
    loadGame({ getItem: () => JSON.stringify(bad), setItem: () => {} }, 55)
      .notice,
  ).not.toBeNull();
  const teams = createLeague({ ...performanceRun(), movesetVersion: 1 }).map(
    (t) => ({ ...t, abilityMasteryVersion: undefined }),
  );
  expect(() => validateLeagueTeams(teams, true)).toThrow();
});
