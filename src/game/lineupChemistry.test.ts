import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  evaluateLineupChemistry,
  type ChemistryPlayer,
} from "./lineupChemistry";
const player = (pokemonId: number): ChemistryPlayer => ({
  pokemonId,
  profile: structuredClone(playerProfile(POKEMON_BY_ID.get(pokemonId)!)),
});
const context = {
  tactic: "balanced" as const,
  defense: "man" as const,
  abilities: true,
};
const roster = () => [65, 68, 135, 95, 113].map(player);
it("activates named combinations only between distinct players actually on the floor", () => {
  const floor = roster(),
    result = evaluateLineupChemistry(floor, context);
  expect(
    result.links.some(
      (l) => l.pokemonIds.includes(65) && l.pokemonIds.includes(68),
    ),
  ).toBe(true);
  for (const l of result.links) {
    expect(new Set(l.pokemonIds).size).toBe(l.pokemonIds.length);
    expect(
      l.pokemonIds.every((id) => floor.some((p) => p.pokemonId === id)),
    ).toBe(true);
  }
  const swapped = evaluateLineupChemistry(
    [player(10), ...floor.slice(1)],
    context,
  );
  expect(swapped.links.every((l) => !l.pokemonIds.includes(65))).toBe(true);
  expect(swapped.effects[68].screen).not.toBe(result.effects[68].screen);
  expect(() =>
    evaluateLineupChemistry([...floor, player(25)], context),
  ).toThrow();
  expect(() =>
    evaluateLineupChemistry([floor[0], floor[0], ...floor.slice(2)], context),
  ).toThrow();
});
it("retains basketball chemistry with abilities off and is invariant to roster ordering", () => {
  const floor = roster();
  const on = evaluateLineupChemistry(floor, context);
  const off = evaluateLineupChemistry(floor, { ...context, abilities: false });
  expect(off.links).toEqual([]);
  expect(off.effects[65].passing).not.toBe(1);
  expect(off.score).toBe(on.score);
  expect(evaluateLineupChemistry([...floor].reverse(), context)).toEqual(on);
  expect(on.value).toBeGreaterThan(off.value);
});
it("bounds all effects and rewards distinct complementary roles over one superstar with redundant teammates", () => {
  const weak = roster();
  for (const p of weak)
    for (const k of Object.keys(
      p.profile.attributes,
    ) as (keyof typeof p.profile.attributes)[])
      p.profile.attributes[k] = 30;
  for (const k of Object.keys(
    weak[0].profile.attributes,
  ) as (keyof (typeof weak)[0]["profile"]["attributes"])[])
    weak[0].profile.attributes[k] = 95;
  const balanced = roster();
  for (const p of balanced)
    for (const k of Object.keys(
      p.profile.attributes,
    ) as (keyof typeof p.profile.attributes)[])
      p.profile.attributes[k] = 65;
  expect(evaluateLineupChemistry(balanced, context).score).toBeGreaterThan(
    evaluateLineupChemistry(weak, context).score,
  );
  for (const tactic of [
    "balanced",
    "pace",
    "interior",
    "perimeter",
    "defense",
  ] as const) {
    const r = evaluateLineupChemistry(balanced, {
      ...context,
      tactic,
      familiarity: 1,
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.value).toBeGreaterThanOrEqual(-2);
    expect(r.value).toBeLessThanOrEqual(5);
    for (const e of Object.values(r.effects))
      for (const v of Object.values(e)) {
        expect(v).toBeGreaterThanOrEqual(0.94);
        expect(v).toBeLessThanOrEqual(1.08);
      }
  }
});
it("uses one strongest donor per recipient effect and recognizes Plus with Minus", () => {
  const pairs = [311, 312, 68, 95, 113].map(player),
    r = evaluateLineupChemistry(pairs, context);
  expect(r.links.some((l) => l.label === "Plus / Minus")).toBe(true);
  const floor = [65, 63, 68, 10, 11].map(player);
  floor.forEach((p) => (p.profile = structuredClone(pairs[2].profile)));
  const two = evaluateLineupChemistry(floor, context),
    one = evaluateLineupChemistry(
      [floor[0], player(12), ...floor.slice(2)],
      context,
    );
  expect(two.effects[68].movement).toBeCloseTo(one.effects[68].movement, 8);
  // Both creators improve their own passing, but the shared finisher receives only one movement boost.
  expect(
    two.links.filter(
      (l) => l.label === "Creator + finisher" && l.pokemonIds.includes(68),
    ).length,
  ).toBe(2);
  expect(two.effects[63].passing).toBeGreaterThan(one.effects[12].passing);
});
