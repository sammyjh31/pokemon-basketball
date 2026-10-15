import { describe, expect, it } from "vitest";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { attributes, positionRating, teamRatings } from "./ratings";
import { POSITIONS, type Roster } from "./types";

const empty: Roster = { PG: null, SG: null, SF: null, PF: null, C: null };
describe("Pokémon basketball ratings", () => {
  it("bundles complete official data for the original 151", () => {
    expect(POKEMON).toHaveLength(151);
    expect(POKEMON.map((p) => p.id)).toEqual(
      Array.from({ length: 151 }, (_, i) => i + 1),
    );
    expect(POKEMON.filter((p) => p.legendary).map((p) => p.id)).toEqual([
      144, 145, 146, 150, 151,
    ]);
    for (const mon of POKEMON) {
      expect(Object.values(mon.stats)).toHaveLength(6);
      expect(
        Object.values(mon.stats).every((s) => Number.isFinite(s) && s > 0),
      ).toBe(true);
      expect(mon.heightM).toBeGreaterThan(0);
      expect(mon.weightKg).toBeGreaterThan(0);
    }
  });
  it("gives every Pokémon finite bounded attributes and position ratings", () => {
    for (const mon of POKEMON)
      for (const value of [
        ...Object.values(attributes(mon)),
        ...POSITIONS.map((p) => positionRating(mon, p)),
      ]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
  });
  it("distinguishes a playmaker from an interior player", () => {
    const alakazam = POKEMON_BY_ID.get(65)!;
    const snorlax = POKEMON_BY_ID.get(143)!;
    expect(positionRating(alakazam, "PG")).toBeGreaterThan(
      positionRating(alakazam, "C"),
    );
    expect(positionRating(snorlax, "C")).toBeGreaterThan(
      positionRating(snorlax, "PG"),
    );
  });
  it("caps extreme size so long or heavy Pokémon cannot grow without limit", () => {
    const mon = POKEMON[0];
    expect(attributes({ ...mon, heightM: 30, weightKg: 2500 })).toEqual(
      attributes({ ...mon, heightM: 300, weightKg: 25000 }),
    );
  });
  it("labels partial teams and averages only filled positions", () => {
    expect(teamRatings(empty)).toEqual({
      offense: 0,
      defense: 0,
      overall: 0,
      filled: 0,
      complete: false,
    });
    expect(teamRatings({ ...empty, PG: 65 })).toMatchObject({
      filled: 1,
      complete: false,
    });
    expect(
      teamRatings({ PG: 65, SG: 150, SF: 149, PF: 68, C: 143 }),
    ).toMatchObject({ filled: 5, complete: true });
  });
});
