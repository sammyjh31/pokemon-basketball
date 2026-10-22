import { expect, it, vi } from "vitest";
import {
  createEvaluationContext,
  evaluatePlayer,
  evaluatePlayerScore,
  evaluatePlayerScores,
  type EvaluationTeam,
} from "./teamEvaluation";
import { DEFENSE_SCHEMES, POSITIONS, TACTICS } from "./types";
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
const team = (current: boolean): EvaluationTeam => ({
  roster,
  tactic: "balanced",
  defense: "man",
  abilityVersion: 1,
  ...(current
    ? {
        evaluationVersion: 1,
        movesetVersion: 4,
        physicalAbilityVersion: 1,
        abilityMasteryVersion: 1,
        abilityMastery: { 65: 450, 135: 200, 149: 75, 68: 600 },
        moraleVersion: 1,
        morale: {
          65: { score: 12, minutes: 35, success: 50, disruption: 0, games: 8 },
          135: { score: 92, minutes: 25, success: 60, disruption: 0, games: 8 },
        },
        development: { 65: { passing: 3, threePoint: -2 } },
      }
    : {}),
});
it("uses exactly the report's score for every role, scheme and current or historical profile", () => {
  for (const current of [false, true])
    for (const tactic of TACTICS)
      for (const defense of DEFENSE_SCHEMES) {
        const context = createEvaluationContext({
          ...team(current),
          tactic,
          defense,
        });
        for (const id of Object.values(roster))
          for (const role of [undefined, ...POSITIONS])
            expect(evaluatePlayerScore(context, id, role)).toBe(
              evaluatePlayer(context, id, role).score,
            );
      }
});
it("avoids formatting reports during numeric evaluation and honors changed inputs and offsets", () => {
  const context = createEvaluationContext(team(true));
  const overrides = { passing: 5, stamina: -2 };
  const expected = evaluatePlayer(context, 65, "C", overrides).score;
  const formatted = vi.spyOn(Number.prototype, "toFixed");
  try {
    expect(evaluatePlayerScore(context, 65, "C", overrides)).toBe(expected);
    expect(formatted).not.toHaveBeenCalled();
  } finally {
    formatted.mockRestore();
  }
  context.needs.passing.weight = 0;
  context.mastery![65] = 0;
  expect(evaluatePlayerScore(context, 65, "C", overrides)).toBe(
    evaluatePlayer(context, 65, "C", overrides).score,
  );
  expect(() => evaluatePlayerScore(context, -1, "PG")).toThrow(
    "unknown Pokémon",
  );
});

it("scores the whole position set identically after development, morale and signature unlocks", () => {
  const context = createEvaluationContext(team(true));
  for (const id of Object.values(roster))
    expect(evaluatePlayerScores(context, id)).toEqual(
      POSITIONS.map((role) => evaluatePlayer(context, id, role).score),
    );
});
