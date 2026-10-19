import { expect, it } from "vitest";
import { performanceRun } from "./seasonPerformance.testUtils";
import { createLeague } from "./league";
import { coachTrainingPlans } from "./coachTraining";
import { coachMoves } from "./movePolicy";
import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { trainMastery } from "./abilityMastery";
import { finishedGame, officialFixture } from "./officialGame.testUtils";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";
it("coaches include moves and specialization opportunities in real training and shared valuation", () => {
  const t = {
      ...createLeague(performanceRun())[0],
      movesetVersion: 1 as const,
    },
    id = t.roster.PG!;
  const plans = coachTrainingPlans(t);
  expect(plans[id].reasons.join(" ")).toMatch(
    /move.*specialization|specialization.*move/i,
  );
  const value = evaluatePlayer(createEvaluationContext(t), id, "PG");
  expect(
    value.factors.find((f) => f.key === "moves")?.contribution,
  ).toBeGreaterThan(0);
  const old = { ...t, movesetVersion: undefined };
  expect(
    evaluatePlayer(createEvaluationContext(old), id, "PG").factors.some(
      (f) => f.key === "moves",
    ),
  ).toBe(false);
  const assigned = Object.fromEntries(
    Object.values(t.roster).map((id) => [
      id!,
      {
        plan: {
          focus: coachMoves(t, id!).focus,
          intensity: "standard" as const,
        },
      },
    ]),
  );
  const trained = trainMastery(t, assigned, 1, 55),
    before = trainMastery(old, assigned, 1, 55);
  expect(
    trained.changes.some(
      (p) =>
        p.gained >
        before.changes.find((v) => v.pokemonId === p.pokemonId)!.gained,
    ),
  ).toBe(true);
  expect(trained.changes[0].reasons.join(" ")).toMatch(/move/i);
});
it("does not accept invented simulated-move counters in an official arcade box", () => {
  const { teams, fixture } = officialFixture();
  const state = finishedGame(fixture, teams);
  const game = officialGameFromArcade(state, fixture, teams);
  const bad = structuredClone(game);
  bad.match.homeBox[0].abilityActivations!.moves = {
    uses: { protect: 1 },
    energySpent: 3.5,
    energyRecovered: 0,
  };
  expect(() => validateOfficialGame(bad, fixture, teams)).toThrow();
});
