import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { seasonTeams, simulateSeason } from "./season";
import { defaultRotationPlan } from "./rotationPlan";
import { ROSTER_SLOTS, type Run } from "./types";
const base = (): Run => ({
  ...createRun("free", true, 340),
  roster: Object.fromEntries(
    ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
  ) as Run["roster"],
});
describe("fixed-roster franchise seasons", () => {
  it("keeps every franchise species on its club with a fresh schedule seed", () => {
    const run = base(),
      teams = createLeague(run);
    const next = { ...run, leagueTeams: teams, seasonSeed: 123456 };
    expect(seasonTeams(next)).toEqual(teams);
    const result = simulateSeason(next);
    expect(result.modelVersion).toBe(4);
    expect(result.league!.teams).toEqual(teams);
    expect(result.league!.players).toHaveLength(240);
    expect(result.league!.games).toHaveLength(1230);
  });
  it("applies user lineup swaps and coaching without redrafting other clubs", () => {
    const run = base(),
      teams = createLeague(run);
    const next: Run = {
      ...run,
      leagueTeams: teams,
      tactic: "pace",
      defense: "zone",
      rotation: "bench",
      roster: { ...run.roster, PG: run.roster.B1, B1: run.roster.PG },
    };
    const updated = seasonTeams(next);
    expect(updated[0]).toMatchObject({
      roster: next.roster,
      tactic: "pace",
      rotation: "bench",
      defense: "zone",
    });
    expect(updated.slice(1)).toEqual(teams.slice(1));
    expect(updated[0].ratings).not.toEqual(teams[0].ratings);
    expect(teams[0].roster).toEqual(run.roster);
  });
  it("clears an inherited custom rotation when the coach selects a preset before tipoff", () => {
    const run = base(),
      teams = createLeague(run);
    teams[0].rotationPlan = defaultRotationPlan(run.roster);
    const next = { ...run, leagueTeams: teams, rotation: "bench" as const };
    expect(seasonTeams(next)[0].rotationPlan).toBeUndefined();
  });
  it("rejects importing a new species or a duplicated league member", () => {
    const run = base(),
      teams = createLeague(run);
    expect(() =>
      seasonTeams({
        ...run,
        leagueTeams: teams,
        roster: { ...run.roster, PG: teams[1].roster.PG },
      }),
    ).toThrow();
    const duplicated = structuredClone(teams);
    duplicated[1].roster.PG = teams[0].roster.PG;
    expect(() => seasonTeams({ ...run, leagueTeams: duplicated })).toThrow();
  });
  it("leaves model 3 input generation unchanged", () => {
    expect(seasonTeams(base())).toEqual(createLeague(base()));
  });
});
