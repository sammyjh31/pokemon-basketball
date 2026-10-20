import { expect, it } from "vitest";
import { initialState } from "./state";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { validateLeagueTeams } from "./franchiseValidation";
import { loadGame } from "./persistence";
import {
  createLocalLeague,
  parseLocalLeague,
  localLeagueTeams,
} from "./localLeague";
it("starts new solo and local drafts on signatures and retains either recorded version", () => {
  expect(initialState(55).run.movesetVersion).toBe(4);
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
    expect(draft.movesetVersion).toBe(4);
    expect(parseLocalLeague(JSON.stringify(draft)).movesetVersion).toBe(4);
  }
  for (const version of [1, 2, 3, 4] as const) {
    const teams = createLeague({
      ...performanceRun(),
      movesetVersion: version,
    });
    expect(teams.every((t) => t.movesetVersion === version)).toBe(true);
    expect(
      validateLeagueTeams(teams, true).every(
        (t) => t.movesetVersion === version,
      ),
    ).toBe(true);
    const state = initialState(55);
    state.run.movesetVersion = version;
    const restored = loadGame(
      { getItem: () => JSON.stringify(state), setItem: () => {} },
      55,
    );
    expect(restored.notice).toBeNull();
    expect(restored.state.run.movesetVersion).toBe(version);
    const mixed = structuredClone(teams);
    mixed[5].movesetVersion = version === 1 ? 2 : 1;
    expect(() => validateLeagueTeams(mixed, true)).toThrow();
    const invalid = teams.map((t) => ({
      ...t,
      abilityMasteryVersion: undefined,
    }));
    expect(() => validateLeagueTeams(invalid, true)).toThrow();
  }
});
