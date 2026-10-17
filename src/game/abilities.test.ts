import { describe, expect, it } from "vitest";
import { FRANCHISE_POKEMON } from "../data/pokemon";
import {
  abilityImpact,
  speciesAbility,
  addAbilityActivation,
  abilityTotal,
} from "./abilities";

const context = {
  zone: "rim" as const,
  play: "pickRoll" as const,
  contested: true,
  energy: 80,
  clutch: false,
  secondChance: false,
  period: 1,
  margin: 0,
};
describe("species abilities", () => {
  it("covers the entire catalog using species abilities, not primary-type signatures", () => {
    for (const mon of FRANCHISE_POKEMON) {
      const ability = speciesAbility(mon.id);
      expect(ability.name).toBeTruthy();
      expect(ability.description).toBeTruthy();
      expect(ability.tactics.length).toBeGreaterThan(0);
    }
    expect(speciesAbility(25).name).toBe("Static");
    expect(speciesAbility(130).name).toBe("Intimidate");
    expect(speciesAbility(1).name).toBe("Overgrow");
    expect(speciesAbility(81).id).not.toBe(speciesAbility(25).id);
  });
  it("applies Levitate only to contested rim finishes and Intimidate to contested defense", () => {
    expect(abilityImpact(92, "shooter", context)).toBeGreaterThan(0);
    expect(abilityImpact(92, "shooter", { ...context, zone: "three" })).toBe(0);
    expect(abilityImpact(130, "defender", context)).toBeLessThan(0);
    expect(
      abilityImpact(130, "defender", { ...context, contested: false }),
    ).toBe(0);
    expect(abilityImpact(130, "passer", context)).toBe(0);
  });
  it("makes Overgrow a tired-player surge, bounded and deterministic", () => {
    expect(abilityImpact(1, "shooter", context)).toBe(0);
    const tired = { ...context, energy: 40 };
    expect(abilityImpact(1, "shooter", tired)).toBeGreaterThan(0);
    expect(abilityImpact(1, "shooter", tired)).toBe(
      abilityImpact(1, "shooter", tired),
    );
    for (const mon of FRANCHISE_POKEMON) {
      for (const role of ["shooter", "passer", "defender"] as const)
        expect(
          Math.abs(abilityImpact(mon.id, role, tired)),
        ).toBeLessThanOrEqual(0.03);
    }
  });
  it("counts applied effects by role without confusing them with made shots", () => {
    const box = {};
    addAbilityActivation(box, "shooter");
    addAbilityActivation(box, "defender");
    addAbilityActivation(box, "passer");
    expect(abilityTotal(box)).toBe(3);
    expect(box).toEqual({
      abilityActivations: { offense: 1, support: 1, defense: 1 },
    });
    expect(abilityTotal({})).toBe(0);
  });
});
