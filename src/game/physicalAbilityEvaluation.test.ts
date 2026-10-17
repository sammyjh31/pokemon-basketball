import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { speciesAbility } from "./abilities";
import { coachGamePlan, coachRotationMinutes } from "./coachPolicy";
import { coachTrainingPlans } from "./coachTraining";
import { recommendRosterPicks } from "./draftAdvice";
import { teamRatings } from "./ratings";
import type { LeagueTeam, Roster } from "./types";
import {
  compareTeamEvaluation,
  createEvaluationContext,
  evaluatePlayer,
  evaluateTeam,
  evaluationTrainingOptions,
  type EvaluationTeam,
} from "./teamEvaluation";

const team = (): EvaluationTeam => ({
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
  tactic: "interior",
  defense: "zone",
  abilityVersion: 1,
  evaluationVersion: 1,
});
const enabled = () => ({ ...team(), physicalAbilityVersion: 1 as const });
const movementRoster: Roster = {
  PG: 122,
  SG: 38,
  SF: 44,
  PF: 97,
  C: 42,
  B1: 228,
  B2: 23,
  B3: 56,
};
const coached = (
  coachId: string,
  roster = team().roster,
  offset = 0,
): LeagueTeam => ({
  ...team(),
  engineRules: undefined,
  id: 0,
  name: "Physical evaluation fixture",
  roster,
  tactic: "balanced",
  defense: "man",
  rotation: "balanced",
  ratings: teamRatings(roster, "balanced", "balanced"),
  coach: { version: 1, id: coachId },
  development: Object.fromEntries(
    Object.values(roster).map((id) => [
      id!,
      { speed: offset, stamina: offset },
    ]),
  ),
});
const physical = (t: EvaluationTeam, id: number, role = "C" as const) =>
  evaluatePlayer(createEvaluationContext(t), id, role).factors.find(
    (f) => f.key === "physical",
  )?.contribution ?? 0;

describe("shared physical ability evaluation", () => {
  it("adds bounded useful credit without rewriting talent or position ratings", () => {
    const old = evaluatePlayer(createEvaluationContext(team()), 68, "C");
    expect(old.score).toBe(70.8101121613263);
    const next = evaluatePlayer(createEvaluationContext(enabled()), 68, "C");
    expect(next.score).toBeGreaterThan(old.score);
    expect(next.talent).toBe(old.talent);
    expect(next.roleFit).toBe(old.roleFit);
    expect(next.reasons.join(" ")).toMatch(/physical/i);
    for (const id of [68, 143, 149, 114, 129, 65, 121]) {
      expect(physical(enabled(), id)).toBeGreaterThanOrEqual(0);
      expect(physical(enabled(), id)).toBeLessThanOrEqual(4);
    }
    const neutral = [...POKEMON_BY_ID.keys()].find(
      (id) => speciesAbility(id).mechanic === "range",
    )!;
    expect(physical(enabled(), neutral)).toBe(0);
    expect(evaluateTeam(enabled()).score).toBeGreaterThan(
      evaluateTeam(team()).score,
    );
    const delta = compareTeamEvaluation(team(), enabled());
    expect(
      delta.factors.reduce((sum, f) => sum + f.contribution, 0),
    ).toBeCloseTo(delta.delta, 10);
    const reverse = compareTeamEvaluation(enabled(), team());
    expect(
      reverse.factors.reduce((sum, f) => sum + f.contribution, 0),
    ).toBeCloseTo(reverse.delta, 10);
  });

  it("uses developed screen/rebound skills, role, scheme and roster needs", () => {
    const base = enabled();
    const offsets = (amount: number) => ({
      ...base,
      development: {
        68: {
          strength: amount,
          offensiveRebound: amount,
          defensiveRebound: amount,
          composure: amount,
        },
      },
    });
    expect(physical(offsets(20), 68)).toBeGreaterThan(
      physical(offsets(-20), 68),
    );
    const c = createEvaluationContext(base);
    expect(
      evaluatePlayer(c, 68, "C").factors.find((f) => f.key === "physical")!
        .contribution,
    ).toBeGreaterThan(
      evaluatePlayer(c, 68, "PG").factors.find((f) => f.key === "physical")!
        .contribution,
    );
    expect(physical(base, 68)).toBeGreaterThan(
      physical({ ...base, tactic: "perimeter", defense: "man" }, 68),
    );
    const supporting = Object.values(base.roster).filter(
      (id) => id !== 68,
    ) as number[];
    const needs = (amount: number) => ({
      ...base,
      development: Object.fromEntries(
        supporting.map((id) => [id, { defensiveRebound: amount }]),
      ),
    });
    expect(physical(needs(-30), 68)).toBeGreaterThan(physical(needs(30), 68));
  });

  it("changes attainable conditioning and position practice gains", () => {
    for (const [id, role, focus] of [
      [129, "SG", "conditioning"],
      [68, "C", "position"],
    ] as const) {
      const gain = (t: EvaluationTeam) =>
        evaluationTrainingOptions(t, id, role).find((p) => p.focus === focus)!
          .gain;
      expect(gain(enabled())).toBeGreaterThan(gain(team()));
    }
  });

  it("preserves every legacy evaluation field and removes physical credit when abilities are disabled", () => {
    const old = team();
    const off = { ...enabled(), engineRules: { abilities: false } };
    const oldOff = { ...old, engineRules: { abilities: false } };
    expect(evaluateTeam(off)).toEqual(evaluateTeam(oldOff));
    expect(evaluationTrainingOptions(off, 68, "C")).toEqual(
      evaluationTrainingOptions(oldOff, 68, "C"),
    );
    expect(evaluateTeam({ ...enabled(), abilityVersion: undefined })).toEqual(
      evaluateTeam({ ...old, abilityVersion: undefined }),
    );
    expect(evaluateTeam({ ...old, physicalAbilityVersion: undefined })).toEqual(
      evaluateTeam(old),
    );
    expect(
      evaluatePlayer(createEvaluationContext(old), 68, "C").factors.map(
        (f) => f.key,
      ),
    ).toEqual(["talent", "role", "scheme", "needs", "ability"]);
  });

  it("lets developed physical movement change close offensive and defensive plan choices", () => {
    const offense = coached("brock", movementRoster, 17.5);
    expect(coachGamePlan(offense).tactic).toBe("interior");
    expect(
      coachGamePlan({ ...offense, physicalAbilityVersion: 1 }).tactic,
    ).toBe("pace");
    const defense = coached("ash", team().roster, -23.5);
    expect(coachGamePlan(defense).defense).toBe("man");
    expect(
      coachGamePlan({ ...defense, physicalAbilityVersion: 1 }).defense,
    ).toBe("press");
  });

  it("uses physical value in actual training focus and automatic minute allocation", () => {
    const training = coached("jessie", movementRoster);
    expect(coachTrainingPlans(training)[38].plan.focus).toBe("playmaking");
    const next = coachTrainingPlans({
      ...training,
      physicalAbilityVersion: 1,
    })[38];
    expect(next.plan).toMatchObject({ focus: "position", position: "PG" });
    expect(next.reasons.join(" ")).toMatch(/physical basketball adaptation/i);
    const rotation = coached("ash");
    const before = coachRotationMinutes(rotation);
    const after = coachRotationMinutes({
      ...rotation,
      physicalAbilityVersion: 1,
    });
    expect(after.PF).toBeGreaterThan(before.PF);
    expect(Object.values(after).reduce((n, x) => n + x, 0)).toBe(240);
    const disabled: LeagueTeam = {
      ...training,
      engineRules: {
        version: 1,
        abilities: false,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    };
    const flaggedDisabled = { ...disabled, physicalAbilityVersion: 1 as const };
    expect(coachTrainingPlans(flaggedDisabled)).toEqual(
      coachTrainingPlans(disabled),
    );
    expect(coachGamePlan(flaggedDisabled)).toEqual(coachGamePlan(disabled));
    expect(coachRotationMinutes(flaggedDisabled)).toEqual(
      coachRotationMinutes(disabled),
    );
  });

  it("carries physical value into draft advice for the vacant role", () => {
    const roster = { ...team().roster, PF: null };
    const pool = [POKEMON_BY_ID.get(68)!];
    const before = recommendRosterPicks(pool, roster, "interior", 1, team())[0];
    const after = recommendRosterPicks(
      pool,
      roster,
      "interior",
      1,
      enabled(),
    )[0];
    expect(after.slot).toBe("PF");
    expect(after.score).toBeGreaterThan(before.score);
    expect(after.fit).toBe(before.fit);
    expect(after.reasons.join(" ")).toMatch(/physical effects/i);
  });
});
