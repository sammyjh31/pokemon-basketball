import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { emptyRoster } from "./types";
import {
  createEvaluationContext,
  evaluatePlayer,
  evaluateTeam,
  compareTeamEvaluation,
  evaluationTrainingOptions,
  evaluationGamePlan,
  projectedLineupChemistry,
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
  it("lets a practiced connection decide a close projected lineup choice", () => {
    const fresh: EvaluationTeam = {
      ...team(),
      coach: undefined,
      chemistryVersion: 1,
      chemistryGrowthVersion: 1,
      engineRules: { abilities: false },
    };
    const experienced = {
      ...fresh,
      chemistryBonds: {
        "65:68": 6000,
        "68:135": 6000,
        "68:149": 6000,
        "6:68": 6000,
      },
    };
    expect(
      projectedLineupChemistry(fresh)!.players.find((p) => p.role === "PF")
        ?.pokemonId,
    ).toBe(131);
    expect(
      projectedLineupChemistry(experienced)!.players.find(
        (p) => p.role === "PF",
      )?.pokemonId,
    ).toBe(68);
  });

  it("prefers a returning partner in a close roster move while stronger unfamiliar talent remains valuable", () => {
    const fresh: EvaluationTeam = {
      ...team(),
      coach: undefined,
      chemistryVersion: 1,
      chemistryGrowthVersion: 1,
      engineRules: { abilities: false },
    };
    const returning = {
      ...fresh,
      chemistryBonds: {
        "6:376": 6000,
        "65:376": 6000,
        "68:376": 6000,
        "121:376": 6000,
        "131:376": 6000,
        "143:376": 6000,
        "149:376": 6000,
      },
    };
    const replacement = (t: EvaluationTeam, id: number) => ({
      ...t,
      roster: { ...t.roster, SG: id },
    });
    const unfamiliar = compareTeamEvaluation(fresh, replacement(fresh, 376));
    const reunited = compareTeamEvaluation(
      returning,
      replacement(returning, 376),
    );
    expect(unfamiliar.delta).toBeLessThan(0);
    expect(reunited.delta).toBeGreaterThan(0);
    expect(
      compareTeamEvaluation(returning, replacement(returning, 150)).delta,
    ).toBeGreaterThan(reunited.delta);
    expect(
      compareTeamEvaluation(returning, replacement(returning, 129)).delta,
    ).toBeLessThan(0);
  });

  it("values earned familiarity without abilities and ignores unversioned history", () => {
    const fresh = {
      ...team(),
      chemistryVersion: 1 as const,
      chemistryGrowthVersion: 1 as const,
      engineRules: { abilities: false },
    };
    const ids = Object.values(fresh.roster) as number[];
    const chemistryBonds = Object.fromEntries(
      ids.flatMap((a, index) =>
        ids
          .slice(index + 1)
          .map((b) => [[a, b].sort((x, y) => x - y).join(":"), 600]),
      ),
    );
    const experienced = { ...fresh, chemistryBonds };
    const projection = projectedLineupChemistry(experienced)!;
    expect(projection.chemistry.continuity?.score).toBeCloseTo(50);
    expect(projection.chemistry.continuity?.sharedMinutes).toBe(600);
    expect(projection.chemistry.links).toEqual([]);
    expect(evaluateTeam(experienced).score).toBeGreaterThan(
      evaluateTeam(fresh).score,
    );
    expect(
      evaluateTeam({ ...experienced, chemistryGrowthVersion: undefined }),
    ).toEqual(evaluateTeam({ ...fresh, chemistryGrowthVersion: undefined }));
    const comparison = compareTeamEvaluation(experienced, fresh);
    expect(
      comparison.factors.find(
        (factor) => factor.label === "Projected five-player chemistry",
      )?.detail,
    ).toMatch(/600\.0.*0\.0.*shared minutes/);
  });

  it("chooses the more complementary trade when raw team value favors another player", () => {
    const paired: EvaluationTeam = {
      abilityVersion: 1,
      tactic: "balanced",
      defense: "man",
      roster: {
        PG: 311,
        SG: 312,
        SF: 65,
        PF: 68,
        C: 95,
        B1: null,
        B2: null,
        B3: null,
      },
    };
    const unpaired = { ...paired, roster: { ...paired.roster, SG: 34 } };
    expect(compareTeamEvaluation(unpaired, paired).delta).toBeLessThan(0);
    expect(
      compareTeamEvaluation(
        { ...unpaired, chemistryVersion: 1 },
        { ...paired, chemistryVersion: 1 },
      ).delta,
    ).toBeGreaterThan(0);
    const disabled = {
      ...paired,
      chemistryVersion: 1 as const,
      engineRules: { abilities: false },
    };
    const projection = projectedLineupChemistry(disabled)!;
    expect(projection.chemistry.links).toEqual([]);
    expect(projection.chemistry.score).toBeGreaterThan(0);
    expect(
      evaluateTeam(disabled).factors.find((f) => f.key === "chemistry")?.value,
    ).toBeGreaterThan(0);
  });

  it("lets complete-unit partnerships change a close automatic game-plan decision", () => {
    const t = {
      ...team(),
      coach: { version: 1 as const, id: "oak" },
      development: Object.fromEntries(
        Object.values(team().roster).map((id) => [id, { threePoint: 29.1 }]),
      ),
    };
    expect(evaluationGamePlan(t).tactic).toBe("perimeter");
    expect(evaluationGamePlan({ ...t, chemistryVersion: 1 }).tactic).toBe(
      "balanced",
    );
  });

  it("credits practice that improves a creator's contribution to the projected five", () => {
    const t = { ...team(), coach: undefined };
    const gain = (chemistryVersion?: 1) =>
      evaluationTrainingOptions({ ...t, chemistryVersion }, 65, "PG").find(
        (plan) => plan.focus === "playmaking",
      )!.gain;
    expect(gain(1)).toBeGreaterThan(gain());
  });

  it("values the projected five together only under the chemistry rules", () => {
    const legacy = team();
    const current = { ...legacy, chemistryVersion: 1 as const };
    const result = evaluateTeam(current);
    const factor = result.factors.find((f) => f.key === "chemistry");
    expect(factor?.value).toBeGreaterThan(0);
    expect(factor?.contribution).toBeGreaterThan(0);
    expect(
      evaluateTeam(legacy).factors.some((f) => f.key === "chemistry"),
    ).toBe(false);
    expect(
      result.factors.reduce((sum, f) => sum + f.contribution, 0),
    ).toBeCloseTo(result.score, 10);
  });
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
