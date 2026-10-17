import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { emptyRoster } from "./types";
import {
  createEvaluationContext,
  evaluatePlayer,
  evaluateTeam,
  compareTeamEvaluation,
  evaluationTrainingOptions,
  type EvaluationTeam,
} from "./teamEvaluation";
const team = (): EvaluationTeam => ({
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
  tactic: "balanced",
  defense: "man",
  coach: { version: 1, id: "misty" },
  abilityVersion: 1,
});
describe("shared evaluation", () => {
  it("is deterministic, finite for empty rosters, and explains the complete score", () => {
    const t = team(),
      before = JSON.stringify(t);
    const c = createEvaluationContext(t);
    const p = evaluatePlayer(c, 135, "SG");
    expect(p).toEqual(evaluatePlayer(createEvaluationContext(t), 135, "SG"));
    expect(p.factors.reduce((n, f) => n + f.contribution, 0)).toBeCloseTo(
      p.score,
      10,
    );
    expect(
      evaluateTeam(t).factors.reduce((n, f) => n + f.contribution, 0),
    ).toBeCloseTo(evaluateTeam(t).score, 10);
    expect(JSON.stringify(t)).toBe(before);
    expect(
      Number.isFinite(
        evaluatePlayer(
          createEvaluationContext({ ...t, roster: emptyRoster() }),
          135,
        ).score,
      ),
    ).toBe(true);
  });
  it("responds to coach, development, position and supporting roster without stale caches", () => {
    const t = team();
    const original = evaluatePlayer(createEvaluationContext(t), 135, "SG");
    expect(
      evaluatePlayer(
        createEvaluationContext({ ...t, coach: { version: 1, id: "brock" } }),
        135,
        "SG",
      ).score,
    ).not.toBe(original.score);
    t.development = { 135: { threePoint: 20, passing: 15 } };
    expect(
      evaluatePlayer(createEvaluationContext(t), 135, "SG").score,
    ).toBeGreaterThan(original.score);
    expect(
      evaluatePlayer(createEvaluationContext(t), 135, "C").roleFit,
    ).toBeLessThan(original.roleFit);
    const c = createEvaluationContext(t);
    t.roster = { ...emptyRoster(), PG: 68, SG: 143, SF: 76 };
    expect(createEvaluationContext(t).needs).not.toEqual(c.needs);
  });
  it("keeps ability credit bounded and obeys the explicit local ability switch", () => {
    const t = team();
    const enabled = evaluatePlayer(createEvaluationContext(t), 135);
    const disabled = evaluatePlayer(
      createEvaluationContext({ ...t, engineRules: { abilities: false } }),
      135,
    );
    const ability = (p: typeof enabled) =>
      p.factors.find((f) => f.key === "ability")!.contribution;
    expect(ability(enabled)).toBeGreaterThan(0);
    expect(ability(enabled)).toBeLessThanOrEqual(4);
    expect(ability(disabled)).toBe(0);
    expect(disabled.talent).toBe(enabled.talent);
  });
  it("compares developed complete rosters with reconciled factors and neutral identity moves", () => {
    const t = team();
    expect(compareTeamEvaluation(t, structuredClone(t)).delta).toBe(0);
    const next = {
      ...t,
      development: { 135: { threePoint: 20, passing: 20 } },
    };
    const d = compareTeamEvaluation(t, next);
    expect(d.delta).toBeGreaterThan(0);
    expect(d.factors.reduce((n, f) => n + f.contribution, 0)).toBeCloseTo(
      d.delta,
      10,
    );
    expect(d.delta).toBeCloseTo(
      evaluateTeam(next).score - evaluateTeam(t).score,
      10,
    );
  });
  it("ranks attainable training changes and leaves inputs untouched", () => {
    const t = team(),
      before = JSON.stringify(t);
    const plans = evaluationTrainingOptions(t, 135, "SG");
    expect(plans).toHaveLength(5);
    expect(plans.every((p) => Number.isFinite(p.gain))).toBe(true);
    expect(plans[0].gain).toBeGreaterThanOrEqual(plans.at(-1)!.gain);
    expect(plans[0].reasons.join(" ")).toMatch(/team value/i);
    expect(JSON.stringify(t)).toBe(before);
    expect(POKEMON_BY_ID.has(135)).toBe(true);
  });
});
it("values a shooting practice gain more when teammates cannot supply spacing", () => {
  const t = { ...team(), coach: undefined, tactic: "perimeter" as const };
  const others = Object.values(t.roster).filter((id) => id !== 135) as number[];
  const altered = (amount: number) => ({
    ...t,
    development: Object.fromEntries(
      others.map((id) => [id, { threePoint: amount }]),
    ),
  });
  const gain = (amount: number) =>
    evaluationTrainingOptions(altered(amount), 135, "SG").find(
      (p) => p.focus === "shooting",
    )!.gain;
  expect(gain(-30)).toBeGreaterThan(gain(30));
});
