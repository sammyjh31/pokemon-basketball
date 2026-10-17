import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { coachRotationMinutes } from "./coachPolicy";
import { coachTrainingPlans, validateCoachTraining } from "./coachTraining";
import {
  createEvaluationContext,
  evaluatePlayer,
  evaluateTeam,
  projectedLineupChemistry,
} from "./teamEvaluation";
import { ROSTER_SLOTS, type LeagueTeam } from "./types";

const state = (score = 50, minutes = 30) => ({
  score,
  minutes,
  success: 50,
  disruption: 0,
  games: 10,
});
function team(): LeagueTeam {
  const base = createLeague({
    ...createRun("free", true, 882),
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  })[0];
  return {
    ...base,
    coach: { version: 1, id: "ash" },
    moraleVersion: 1,
    chemistryVersion: 1,
    chemistryGrowthVersion: 1,
    evaluationVersion: 1,
    morale: Object.fromEntries(
      Object.values(base.roster).map((id) => [id!, state()]),
    ),
  };
}

describe("automatic morale management", () => {
  it("gives an underused unhappy player support and reduces an overworked player's target without breaking minute budgets", () => {
    const t = team();
    const supported = { ...t, morale: { ...t.morale, 65: state(25, 0) } };
    const recovered = { ...t, morale: { ...t.morale, 65: state(25, 40) } };
    const a = coachRotationMinutes(supported),
      b = coachRotationMinutes(recovered);
    expect(a.PG).toBeGreaterThan(b.PG);
    for (const result of [a, b]) {
      expect(Object.values(result).reduce((sum, n) => sum + n, 0)).toBe(240);
      expect(
        Object.values(result).every(
          (n) => Number.isInteger(n) && n >= 0 && n <= 40,
        ),
      ).toBe(true);
    }
    const rearranged = {
      ...supported,
      roster: {
        ...supported.roster,
        PG: supported.roster.B3,
        B3: supported.roster.PG,
      },
    };
    const rearrangedMinutes = coachRotationMinutes(rearranged);
    expect(a.PG).toBe(rearrangedMinutes.B3);
  });

  it("automatically moderates distressed and overworked players' training and keeps the report valid", () => {
    const t = team();
    const needsSupport = {
      ...t,
      morale: Object.fromEntries(
        ROSTER_SLOTS.map((slot, i) => [
          t.roster[slot]!,
          state(i % 2 ? 20 : 60, i % 2 ? 12 : 40),
        ]),
      ),
    };
    const plans = coachTrainingPlans(needsSupport);
    for (const plan of Object.values(plans)) {
      expect(plan.plan.intensity).toBe("steady");
      expect(plan.reasons.join(" ")).toMatch(/morale|recovery|workload/i);
      expect(validateCoachTraining(plan, "ash")).toEqual(plan);
    }
  });

  it("counts temporary execution once, preserves raw talent and reconciles team value", () => {
    const t = team();
    const high = {
      ...t,
      morale: Object.fromEntries(
        Object.keys(t.morale!).map((id) => [id, state(95)]),
      ),
    };
    const low = {
      ...t,
      morale: Object.fromEntries(
        Object.keys(t.morale!).map((id) => [id, state(5)]),
      ),
    };
    const before = JSON.stringify(high);
    const happy = evaluatePlayer(createEvaluationContext(high), 65);
    const unhappy = evaluatePlayer(createEvaluationContext(low), 65);
    expect(happy.talent).toBe(unhappy.talent);
    expect(happy.roleFit).toBe(unhappy.roleFit);
    expect(happy.score).toBeGreaterThan(unhappy.score);
    expect(
      happy.factors.find((f) => f.key === "morale")!.contribution,
    ).toBeGreaterThan(0);
    expect(
      unhappy.factors.find((f) => f.key === "morale")!.contribution,
    ).toBeLessThan(0);
    const value = evaluateTeam(high);
    expect(
      value.factors.reduce((sum, f) => sum + f.contribution, 0),
    ).toBeCloseTo(value.score, 10);
    expect(JSON.stringify(high)).toBe(before);
    expect(evaluateTeam({ ...high, moraleVersion: undefined })).toEqual(
      evaluateTeam({ ...low, moraleVersion: undefined }),
    );
  });

  it("uses only the selected five's morale for projected cohesion", () => {
    const t = team();
    const projection = projectedLineupChemistry(t)!;
    const selected = new Set(projection.players.map((p) => p.pokemonId));
    const changed = {
      ...t,
      morale: Object.fromEntries(
        Object.keys(t.morale!).map((id) => [
          id,
          state(selected.has(Number(id)) ? 85 : 5),
        ]),
      ),
    };
    const next = projectedLineupChemistry(changed)!;
    const expected =
      next.players.reduce(
        (sum, p) => sum + changed.morale[p.pokemonId].score,
        0,
      ) / 5;
    expect(next.chemistry.morale?.score).toBeCloseTo(expected);
    expect(next.chemistry.morale?.cohesionDelta).toBeGreaterThan(0);
  });
});
