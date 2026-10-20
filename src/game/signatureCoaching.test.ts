import type { AbilityBox } from "./abilities";
import { expect, it } from "vitest";
import { signatureTeam } from "./signatureTestUtils";
import { coachTrainingPlans, validateCoachTraining } from "./coachTraining";
import { signatureTrainingFocus } from "./movePolicy";
import { advanceMastery } from "./abilityMastery";
import { simulateMatch } from "./match";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
it("keeps every CPU coach's signature practice report within the saved-report bounds", () => {
  for (const base of createLeague(performanceRun())) {
    const team = {
      ...base,
      movesetVersion: 2 as const,
      abilityMastery: Object.fromEntries(
        Object.values(base.roster).map((id) => [id!, 400]),
      ),
    };
    for (const plan of Object.values(coachTrainingPlans(team)))
      expect(
        () => validateCoachTraining(plan),
        JSON.stringify(plan),
      ).not.toThrow();
  }
});
it.each([0, 400])(
  "plans signature/combo practice with valid reports at %s XP",
  (xp) => {
    const team = {
      ...signatureTeam(),
      coach: { id: "ash", version: 1 as const },
      abilityMastery: Object.fromEntries(
        Object.values(signatureTeam().roster).map((id) => [id!, xp]),
      ),
    };
    expect(signatureTrainingFocus(team, 25)).toBeTruthy();
    const plans = coachTrainingPlans(team);
    for (const p of Object.values(plans))
      expect(validateCoachTraining(p)).toEqual(p);
    expect(
      Object.values(plans).some((p) =>
        p.reasons.some((r) => /signature/i.test(r)),
      ),
    ).toBe(true);
    expect(
      Object.values(plans).some((p) => p.reasons.some((r) => /combo/i.test(r))),
    ).toBe(true);
    expect(
      signatureTrainingFocus({ ...team, movesetVersion: 1 }, 25),
    ).toBeUndefined();
  },
);
it("credits completed combo participation, caps its opportunity and preserves version-one XP", () => {
  const team = signatureTeam();
  const match = { overtimePeriods: 0 };
  const boxes: (AbilityBox & { pokemonId: number; minutes: number })[] =
    Object.values(team.roster).map((pokemonId) => ({
      pokemonId: pokemonId!,
      minutes: 20,
      abilityActivations: {
        offense: 0,
        support: 0,
        defense: 0,
        moves: { uses: {}, energySpent: 0, energyRecovered: 0 },
      },
    }));
  const id = boxes.find((b) => b.minutes > 0)!.pokemonId;
  for (const b of boxes)
    if (b.abilityActivations?.moves) delete b.abilityActivations.moves.combos;
  const box = boxes.find((b) => b.pokemonId === id)!;
  box.abilityActivations = {
    offense: 0,
    support: 0,
    defense: 0,
    moves: {
      uses: {},
      energySpent: 0,
      energyRecovered: 0,
      combos: {
        attempts: { "pick-roll": 2 },
        shotsCreated: { "pick-roll": 2 },
      },
    },
  };
  const clean = structuredClone(boxes);
  delete clean.find((b) => b.pokemonId === id)!.abilityActivations!.moves!
    .combos;
  const base = advanceMastery(team, clean, match.overtimePeriods)[id];
  expect(
    advanceMastery(team, boxes, match.overtimePeriods)[id],
  ).toBeGreaterThan(base);
  box.abilityActivations.moves!.combos = {
    attempts: { "pick-roll": 100 },
    shotsCreated: { "pick-roll": 100 },
  };
  expect(advanceMastery(team, boxes, match.overtimePeriods)[id]).toBe(
    advanceMastery(
      team,
      [
        {
          ...box,
          abilityActivations: {
            ...box.abilityActivations,
            moves: {
              ...box.abilityActivations.moves!,
              combos: {
                attempts: { "pick-roll": 2 },
                shotsCreated: { "pick-roll": 2 },
              },
            },
          },
        },
        ...boxes.filter((b) => b !== box),
      ],
      match.overtimePeriods,
    )[id],
  );
  expect(
    advanceMastery(
      { ...team, movesetVersion: 1 },
      boxes,
      match.overtimePeriods,
    )[id],
  ).toBe(base);
});
