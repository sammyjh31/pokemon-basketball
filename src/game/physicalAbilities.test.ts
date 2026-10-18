import { expect, it } from "vitest";
import { FRANCHISE_POKEMON } from "../data/pokemon";
import {
  physicalAbilityEffects,
  physicalAbilitiesEnabled,
  abilityEnergyChange,
} from "./physicalAbilities";
import {
  abilityTotal,
  recordPhysicalAbility,
  mergeAbilityActivations,
  validateAbilityActivations,
  type AbilityBox,
} from "./abilities";
it("gates physical abilities independently of old shot abilities and the league switch", () => {
  expect(physicalAbilitiesEnabled({ abilityVersion: 1 })).toBe(false);
  expect(
    physicalAbilitiesEnabled({ abilityVersion: 1, physicalAbilityVersion: 1 }),
  ).toBe(true);
  expect(
    physicalAbilitiesEnabled({
      abilityVersion: 1,
      physicalAbilityVersion: 1,
      engineRules: { abilities: false },
    }),
  ).toBe(false);
});
it("gives species different bounded physical tools and preserves conditional surges", () => {
  expect(physicalAbilityEffects(92).rebound).toBeGreaterThan(1);
  expect(physicalAbilityEffects(95).screen).toBeGreaterThan(1);
  expect(physicalAbilityEffects(52).rebound).toBeGreaterThan(
    physicalAbilityEffects(95).rebound,
  );
  expect(physicalAbilityEffects(1, 100).movement).toBe(1);
  expect(physicalAbilityEffects(1, 40).movement).toBeGreaterThan(1);
  for (const p of FRANCHISE_POKEMON)
    for (const energy of [25, 55, 75, 100]) {
      const effect = physicalAbilityEffects(p.id, energy);
      for (const v of Object.values(effect)) {
        expect(v).toBeGreaterThanOrEqual(0.8);
        expect(v).toBeLessThanOrEqual(1.2);
      }
    }
});
it("conserves energy only when it changes actual energy after floors and caps", () => {
  expect(abilityEnergyChange(113, 60, -10, true)).toEqual({
    energy: 51.8,
    saved: 1.7999999999999972,
  });
  expect(abilityEnergyChange(113, 100, 10, true)).toEqual({
    energy: 100,
    saved: 0,
  });
  expect(abilityEnergyChange(113, 25, -10, true, 25)).toEqual({
    energy: 25,
    saved: 0,
  });
  expect(abilityEnergyChange(113, 60, -10, false)).toEqual({
    energy: 50,
    saved: 0,
  });
});
it("keeps mastered physical effects immutable so one caller cannot poison later games", () => {
  const effect = physicalAbilityEffects(113, 60, 200);
  expect(effect.drain).toBeCloseTo(0.8056, 12);
  expect(Reflect.set(effect, "drain", 999)).toBe(false);
  expect(physicalAbilityEffects(113, 60, 200).drain).toBeCloseTo(0.8056, 12);
});
it("retains exact mastery and energy boundaries when reusing physical effects", () => {
  for (const [xp, drain] of [
    [0, 0.82],
    [75, 0.8128],
    [200, 0.8056],
    [400, 0.7984],
    [700, 0.7912],
    [1000, 0.784],
  ])
    expect(physicalAbilityEffects(113, 60, xp).drain).toBeCloseTo(drain, 12);
  expect(physicalAbilityEffects(1, 55, 200).movement).toBeCloseTo(1.054, 12);
  expect(physicalAbilityEffects(1, 55.0001, 200).movement).toBe(1);
  expect(physicalAbilityEffects(1, 55, 200).movement).toBeCloseTo(1.054, 12);
  expect(physicalAbilityEffects(113, 60, NaN).drain).toBe(0.82);
});
it("aggregates physical effects without inflating shot activations or aliasing source stats", () => {
  const source: AbilityBox = {},
    target: AbilityBox = {};
  recordPhysicalAbility(source, "movement", 1.25);
  recordPhysicalAbility(source, "screens");
  recordPhysicalAbility(source, "energySaved", 0.4);
  recordPhysicalAbility(source, "rebounds", 0);
  expect(abilityTotal(source)).toBe(0);
  mergeAbilityActivations(target, source);
  mergeAbilityActivations(target, source);
  expect(target.abilityActivations!.physical).toEqual({
    movement: 2.5,
    screens: 2,
    rebounds: 0,
    energySaved: 0.8,
  });
  expect(source.abilityActivations!.physical!.screens).toBe(1);
  expect(validateAbilityActivations(target.abilityActivations)).toEqual(
    target.abilityActivations,
  );
  expect(
    JSON.stringify(validateAbilityActivations(target.abilityActivations)),
  ).toBe(JSON.stringify(target.abilityActivations));
  for (const invalid of [
    { movement: NaN },
    { screens: 0.5 },
    { energySaved: -1 },
    { extra: 1 },
  ]) {
    expect(() =>
      validateAbilityActivations({
        ...source.abilityActivations,
        physical: { ...source.abilityActivations!.physical, ...invalid },
      }),
    ).toThrow();
  }
});
