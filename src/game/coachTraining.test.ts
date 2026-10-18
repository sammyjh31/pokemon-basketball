import { describe, expect, it } from "vitest";
import { coachTrainingPlans, validateCoachTraining } from "./coachTraining";
import { rookieFixture } from "./rookieDraft.testUtils";
import { assignLeagueCoaches } from "./trainerCoaches";
import { leaguePlayers } from "./leagueStats";
import { developPlayer, processOffseason } from "./offseason";
import { DEVELOPMENT_SKILLS } from "./developmentTypes";
import { validateTrainingPlans } from "./training";
import type { LeagueTeam, SeasonResult, Run } from "./types";

const team = (id = "ash"): LeagueTeam => ({
  ...rookieFixture().franchise!.teams[0],
  coach: { version: 1, id },
});
const focuses = (t: LeagueTeam) =>
  Object.values(coachTrainingPlans(t)).map((a) => a.plan.focus);
const alter = (
  t: LeagueTeam,
  ids: number[],
  skills: string[],
  amount: number,
): LeagueTeam => ({
  ...t,
  development: Object.fromEntries(
    Object.values(t.roster).map((id) => [
      id!,
      Object.fromEntries(
        DEVELOPMENT_SKILLS.map((skill) => [
          skill,
          ids.includes(id!) && skills.includes(skill) ? amount : 0,
        ]),
      ),
    ]),
  ),
});

describe("automatic coach training", () => {
  it("supports fragile personalities while challenging resilient ambitious players within coach workload limits", () => {
    const modern = {
      ...team("ash"),
      evaluationVersion: 1 as const,
      chemistryVersion: 1 as const,
      chemistryGrowthVersion: 1 as const,
      physicalAbilityVersion: 1 as const,
      moraleVersion: 1 as const,
      personalityVersion: 1 as const,
    };
    const plans = coachTrainingPlans(modern);
    expect(plans[68].plan.intensity).toBe("steady");
    expect(plans[68].reasons.join(" ")).toMatch(/personality.*support/i);
    expect(plans[59].plan.intensity).toBe("aggressive");
    expect(plans[59].reasons.join(" ")).toMatch(/personality.*challenge/i);
    expect(
      coachTrainingPlans({ ...modern, coach: { version: 1, id: "mom" } })[59]
        .plan.intensity,
    ).toBe("steady");
    const players = leaguePlayers([modern]).map((p) => ({
      ...p,
      gamesPlayed: 82,
      minutes: 82 * 40,
    }));
    expect(coachTrainingPlans(modern, players)[59].plan.intensity).toBe(
      "steady",
    );
    for (const assignment of Object.values(plans))
      expect(validateCoachTraining(assignment)).toEqual(assignment);
    const legacy = coachTrainingPlans({
      ...modern,
      personalityVersion: undefined,
    });
    expect(legacy[68].plan.intensity).toBe("aggressive");
    expect(legacy[68].reasons.join(" ")).not.toMatch(/personality/i);
  });
  it("assigns valid, deterministic plans to all eight players without mutating the roster", () => {
    const t = team(),
      before = JSON.stringify(t),
      plans = coachTrainingPlans(t);
    expect(Object.keys(plans)).toHaveLength(8);
    expect(coachTrainingPlans(t)).toEqual(plans);
    expect(
      validateTrainingPlans(
        Object.fromEntries(
          Object.entries(plans).map(([id, a]) => [id, a.plan]),
        ),
        t.roster,
      ),
    ).toBeDefined();
    for (const a of Object.values(plans)) {
      expect(a.coachId).toBe("ash");
      expect(a.reasons.length).toBeGreaterThanOrEqual(3);
    }
    expect(JSON.stringify(t)).toBe(before);
    expect(new Set(focuses(t)).size).toBeGreaterThan(1);
    expect(coachTrainingPlans({ ...t, coach: undefined })).toEqual({});
  });
  it("changes focus with coaching philosophy and changes intensity with risk tolerance", () => {
    expect(focuses(team("ash"))).not.toEqual(focuses(team("brock")));
    expect(focuses(team("misty"))).not.toEqual(focuses(team("brock")));
    const conservative = Object.values(coachTrainingPlans(team("mom")));
    expect(conservative.every((a) => a.plan.intensity !== "aggressive")).toBe(
      true,
    );
    expect(
      Object.values(coachTrainingPlans(team("ash"))).some(
        (a) => a.plan.intensity === "aggressive",
      ),
    ).toBe(true);
  });
  it("responds to developed player skills and the needs of teammates", () => {
    const t = team("clemont"),
      ids = Object.values(t.roster) as number[];
    const shooting = ["threePoint", "midRange", "freeThrow"];
    expect(focuses(alter(t, ids, shooting, -30))).not.toEqual(
      focuses(alter(t, ids, shooting, 30)),
    );
    // Hold each prospect's attributes fixed; only change their teammates.
    expect(
      ids.some((id) => {
        const others = ids.filter((other) => other !== id);
        return (
          coachTrainingPlans(alter(t, others, shooting, -30))[id].plan.focus !==
          coachTrainingPlans(alter(t, others, shooting, 30))[id].plan.focus
        );
      }),
    ).toBe(true);
    expect(
      ids.some(
        (id) =>
          coachTrainingPlans(alter(t, [id], shooting, -30))[id].plan.focus !==
          coachTrainingPlans(alter(t, [id], shooting, 30))[id].plan.focus,
      ),
    ).toBe(true);
  });
  it("reduces training volatility after a heavy season, ignoring another team's stats", () => {
    const t = team(),
      players = leaguePlayers([t]).map((p) => ({
        ...p,
        gamesPlayed: 82,
        minutes: 82 * 42,
      }));
    expect(
      Object.values(coachTrainingPlans(t, players)).every(
        (a) => a.plan.intensity !== "aggressive",
      ),
    ).toBe(true);
    expect(
      coachTrainingPlans(
        t,
        players.map((p) => ({ ...p, teamId: 29 })),
      ),
    ).toEqual(coachTrainingPlans(t));
  });
  it("validates archived assignments and rejects malformed or misattributed records", () => {
    const assignment = Object.values(coachTrainingPlans(team()))[0];
    expect(validateCoachTraining(assignment, "ash")).toEqual(assignment);
    for (const bad of [
      null,
      { ...assignment, version: 2 },
      { ...assignment, coachId: "missing" },
      { ...assignment, plan: { focus: "position", intensity: "standard" } },
      { ...assignment, reasons: ["x".repeat(501)] },
      { ...assignment, reasons: [] },
    ])
      expect(() => validateCoachTraining(bad, "ash")).toThrow();
    expect(() => validateCoachTraining(assignment, "mom")).toThrow();
    expect(() => validateCoachTraining(assignment, null)).toThrow();
  });
  it("uses coach plans for every club's actual development, once, while preserving manual legacy plans", () => {
    const state = rookieFixture();
    const teams = assignLeagueCoaches(
      state.franchise!.teams,
      12,
      new Map([[0, { version: 1, id: "ash" }]]),
    );
    const players = leaguePlayers(teams).map((p) => ({
      ...p,
      gamesPlayed: 82,
      minutes: 2460,
      points: 1100,
      assists: 250,
    }));
    state.franchise = {
      ...state.franchise!,
      teams,
      offseasons: undefined,
      trainingPlans: {
        [players[0].pokemonId]: { focus: "balanced", intensity: "steady" },
      },
    };
    state.run = {
      ...state.run,
      result: { league: { teams, players } } as SeasonResult,
      playoffs: { championId: 29 } as Run["playoffs"],
    };
    const before = JSON.stringify(state),
      next = processOffseason(state);
    const report = next.franchise!.offseasons![0];
    expect(report.players).toHaveLength(240);
    expect(report.players.every((p) => p.training)).toBe(true);
    for (const p of report.players) {
      const source = players.find((row) => row.pokemonId === p.pokemonId)!;
      expect(p.training).toEqual(
        coachTrainingPlans(teams[p.teamId], players)[p.pokemonId],
      );
      expect(p.changes).toEqual(
        developPlayer(
          source,
          {},
          1,
          state.run.seasonSeed,
          p.training!.plan,
          (teams[0].courtVersion ?? 0) >= 3,
        ).changes,
      );
    }
    expect(
      report.players.some(
        (p) =>
          JSON.stringify(p.changes) !==
          JSON.stringify(
            developPlayer(
              players.find((row) => row.pokemonId === p.pokemonId)!,
              {},
              1,
              state.run.seasonSeed,
              undefined,
              (teams[0].courtVersion ?? 0) >= 3,
            ).changes,
          ),
      ),
    ).toBe(true);
    expect(processOffseason(next)).toBe(next);
    expect(JSON.stringify(state)).toBe(before);
    const legacy = {
      ...state,
      franchise: {
        ...state.franchise!,
        teams: teams.map((t) => ({ ...t, coach: undefined })),
      },
    };
    const row = processOffseason(legacy).franchise!.offseasons![0].players[0];
    expect(row.training).toBeUndefined();
    expect(row.changes).toEqual(
      developPlayer(
        players[0],
        {},
        1,
        state.run.seasonSeed,
        state.franchise.trainingPlans![players[0].pokemonId],
        (teams[0].courtVersion ?? 0) >= 3,
      ).changes,
    );
  });
});
