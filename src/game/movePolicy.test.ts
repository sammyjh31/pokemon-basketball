import { expect, it } from "vitest";
import { FRANCHISE_POKEMON } from "../data/pokemon";
import { performanceRun } from "./seasonPerformance.testUtils";
import { createLeague } from "./league";
import { basketballMoves, movePool, movesEnabled } from "./basketballMoves";
import { coachMoves, specializationRules } from "./movePolicy";
const team = () => ({
  ...createLeague(performanceRun())[0],
  movesetVersion: 1 as const,
});
it("gives every generation a usable, species-shaped basketball move pool", () => {
  expect(basketballMoves).toHaveLength(8);
  for (const mon of FRANCHISE_POKEMON)
    expect(movePool(mon.id).length).toBeGreaterThanOrEqual(2);
  expect(movePool(25).map((m) => m.id)).not.toEqual(
    movePool(143).map((m) => m.id),
  );
});
it("coaches equip moves deterministically, with earned slots and unlocked paths", () => {
  const t = team(),
    id = t.roster.PG!;
  expect(coachMoves(t, id).moves).toHaveLength(2);
  expect(coachMoves(t, id).specialization).toBe("fundamentals");
  t.abilityMastery = { ...t.abilityMastery, [id]: 200 };
  expect(coachMoves(t, id).moves).toHaveLength(3);
  expect(coachMoves(t, id).specialization).not.toBe("fundamentals");
  t.abilityMastery[id] = 400;
  expect(coachMoves(t, id).moves).toHaveLength(4);
  expect(coachMoves(t, id)).toEqual(coachMoves(structuredClone(t), id));
  expect(new Set(coachMoves(t, id).moves.map((m) => m.id)).size).toBe(4);
});
it("preserves old and ability-disabled modes without equipping moves", () => {
  const t = team();
  expect(movesEnabled({ ...t, movesetVersion: undefined })).toBe(false);
  expect(
    coachMoves(
      {
        ...t,
        engineRules: {
          version: 1,
          abilities: false,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      },
      t.roster.PG!,
    ).moves,
  ).toEqual([]);
  expect(
    coachMoves({ ...t, movesetVersion: undefined }, t.roster.PG!).moves,
  ).toEqual([]);
});
it("specialization is a real cost/cooldown tradeoff and coaches account for roster and style", () => {
  expect(specializationRules.power.cost).toBeGreaterThan(
    specializationRules.efficiency.cost,
  );
  expect(specializationRules.power.strength).toBeGreaterThan(
    specializationRules.efficiency.strength,
  );
  expect(specializationRules.efficiency.cooldown).toBeLessThan(
    specializationRules.power.cooldown,
  );
  const t = team();
  t.abilityMastery = Object.fromEntries(
    Object.values(t.roster).map((id) => [id!, 400]),
  );
  const aggressive = Object.values(t.roster).map((id) =>
    coachMoves(
      { ...t, coach: { version: 1, id: "surge" }, tactic: "pace" },
      id!,
    ),
  );
  const patient = Object.values(t.roster).map((id) =>
    coachMoves(
      { ...t, coach: { version: 1, id: "oak" }, tactic: "balanced" },
      id!,
    ),
  );
  expect(aggressive.map(p => [p.specialization, p.moves.map(m => m.id)])).not.toEqual(patient.map(p => [p.specialization, p.moves.map(m => m.id)]));
  expect(aggressive.every((p) => p.reasons.length > 1)).toBe(true);
});
