import { expect, it } from "vitest";
import { FRANCHISE_POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { movePool } from "./basketballMoves";
import { signatureMoves, signatureMovesForSpecies } from "./signatureMoves";
import { coachMoves } from "./movePolicy";
import { coachCombos, comboValue, comboTrainingFocus } from "./comboPolicy";
import { pairKey } from "./teammateChemistry";
import { playerProfile } from "./playerProfile";
function club() {
  const roster = {
    PG: 25,
    SG: 65,
    SF: 6,
    PF: 3,
    C: 143,
    B1: 9,
    B2: 212,
    B3: 149,
  };
  return {
    ...createLeague(performanceRun())[0],
    roster,
    movesetVersion: 2 as const,
    abilityMastery: Object.fromEntries(
      Object.values(roster).map((id) => [id, 400]),
    ),
    chemistryBonds: {},
  };
}
it("covers all 18 types and pins species signatures to their declared basketball eligibility", () => {
  expect(
    new Set(
      signatureMoves
        .filter((m) => m.signature?.kind === "type")
        .map((m) => m.signature!.type),
    ).size,
  ).toBe(18);
  for (const mon of FRANCHISE_POKEMON) {
    const moves = signatureMovesForSpecies(mon.id);
    expect(moves.some((m) => m.signature?.kind === "type")).toBe(true);
    expect(moves.every((m) => m.cost > 0 && m.cooldown >= 60)).toBe(true);
  }
  for (const id of [172, 25, 26])
    expect(
      signatureMovesForSpecies(id).some((m) => m.id === "pikachu-volt-tackle"),
    ).toBe(true);
  expect(
    signatureMovesForSpecies(135).some((m) => m.id === "pikachu-volt-tackle"),
  ).toBe(false);
  expect(
    signatureMovesForSpecies(658).some(
      (m) => m.id === "greninja-water-shuriken",
    ),
  ).toBe(true);
  expect(movePool(25, 1).every((m) => !m.signature)).toBe(true);
  expect(movePool(25, 2).some((m) => m.signature)).toBe(true);
});
it("unlocks type moves at 25 and species moves at 100, inside existing slots and stable legacy policy", () => {
  const t = { ...club(), tactic: "pace" as const };
  const before = structuredClone(t);
  const plan = (xp: number) =>
    coachMoves({ ...t, abilityMastery: { ...t.abilityMastery, 25: xp } }, 25);
  expect(plan(24).moves.every((m) => !m.signature)).toBe(true);
  expect(plan(25).moves.some((m) => m.signature?.kind === "type")).toBe(true);
  expect(plan(99).moves.every((m) => m.signature?.kind !== "species")).toBe(
    true,
  );
  expect(plan(100).moves.some((m) => m.id === "pikachu-volt-tackle")).toBe(
    true,
  );
  expect(plan(400).moves).toHaveLength(4);
  expect(
    coachMoves({ ...t, movesetVersion: 1 }, 25).moves.every(
      (m) => !m.signature,
    ),
  ).toBe(true);
  expect(t).toEqual(before);
});
it("chooses bounded automatic pair plans with mastery gates and neutral legacy/disabled rules", () => {
  const t = club(),
    plans = coachCombos(t);
  expect(plans.length).toBeGreaterThan(0);
  expect(plans.length).toBeLessThanOrEqual(8);
  expect(
    new Set(plans.map((p) => `${p.id}:${p.initiatorId}:${p.partnerId}`)).size,
  ).toBe(plans.length);
  expect(
    plans.every(
      (p) =>
        p.initiatorId !== p.partnerId &&
        p.mastery >= 25 &&
        p.fit <= 100 &&
        p.fit >= 0,
    ),
  ).toBe(true);
  expect(coachCombos({ ...t, abilityMastery: {} })).toEqual([]);
  expect(
    coachCombos({ ...t, abilityMastery: {} }, true).some((p) => !p.unlocked),
  ).toBe(true);
  expect(coachCombos({ ...t, movesetVersion: 1 })).toEqual([]);
  expect(coachCombos({ ...t, chemistryVersion: undefined })).toEqual([]);
  expect(coachCombos({ ...t, engineRules: { abilities: false } })).toEqual([]);
  expect(coachCombos(t)).toEqual(coachCombos(structuredClone(t)));
});
it("coaches change pair priorities from earned familiarity and current basketball style", () => {
  const t = club(),
    cold = coachCombos(t),
    target = cold.at(-1)!;
  const warm = coachCombos({
    ...t,
    chemistryBonds: { [pairKey(target.initiatorId, target.partnerId)]: 6000 },
  });
  const index = warm.findIndex(
    (p) =>
      p.id === target.id &&
      p.initiatorId === target.initiatorId &&
      p.partnerId === target.partnerId,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  expect(warm[index].chemistry).toBeGreaterThan(target.chemistry);
  expect(warm[index].fit).toBeGreaterThan(target.fit);
  expect(index).toBeLessThanOrEqual(cold.length - 1);
  const perimeter = coachCombos({
    ...t,
    tactic: "perimeter",
    coach: { version: 1, id: "surge" },
  });
  expect(perimeter.map((p) => [p.id, p.initiatorId, p.partnerId])).not.toEqual(
    cold.map((p) => [p.id, p.initiatorId, p.partnerId]),
  );
});
it("values incoming species with their projected mastery and teaches relevant pair roles without recursion", () => {
  const t = club(),
    p = playerProfile(POKEMON_BY_ID.get(658)!);
  expect(comboValue(t, 658, p, 0)).toBe(0);
  expect(comboValue(t, 658, p, 400)).toBeGreaterThan(0);
  expect(comboValue(t, 658, p, 1000)).toBeLessThanOrEqual(0.4);
  expect(comboValue({ ...t, movesetVersion: 1 }, 658, p, 400)).toBe(0);
  expect(comboTrainingFocus(t, 25)).toMatch(
    /playmaking|position|shooting|conditioning/,
  );
  expect(comboTrainingFocus({ ...t, movesetVersion: 1 }, 25)).toBeUndefined();
});
