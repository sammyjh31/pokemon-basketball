import { describe, expect, it } from "vitest";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import {
  attributes,
  positionRating,
  rotationMinutes,
  teamRatings,
} from "./ratings";
import {
  emptyRoster,
  POSITIONS,
  ROSTER_SLOTS,
  ROTATIONS,
  type Pokemon,
  type Roster,
} from "./types";

const strong: Roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const fixture: Pokemon = {
  ...POKEMON[0],
  types: [],
  heightM: 1.8,
  weightKg: 85,
  stats: {
    hp: 80,
    attack: 80,
    defense: 80,
    specialAttack: 80,
    specialDefense: 80,
    speed: 80,
  },
};

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
  it("gives all 151 players twenty bounded skills and finite position fits", () => {
    for (const mon of POKEMON) {
      expect(Object.values(attributes(mon))).toHaveLength(20);
      for (const value of [
        ...Object.values(attributes(mon)),
        ...POSITIONS.map((p) => positionRating(mon, p)),
      ]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
  it("distinguishes a creator from an interior player", () => {
    const alakazam = POKEMON_BY_ID.get(65)!,
      snorlax = POKEMON_BY_ID.get(143)!;
    expect(positionRating(alakazam, "PG")).toBeGreaterThan(
      positionRating(alakazam, "C") + 10,
    );
    expect(positionRating(snorlax, "C")).toBeGreaterThan(
      positionRating(snorlax, "PG") + 10,
    );
  });
  it("caps extreme size and base stats instead of allowing unlimited scaling", () => {
    expect(attributes({ ...fixture, heightM: 30, weightKg: 2500 })).toEqual(
      attributes({ ...fixture, heightM: 300, weightKg: 25000 }),
    );
    const oversized = {
      ...fixture,
      stats: {
        hp: 1000,
        attack: 1000,
        defense: 1000,
        specialAttack: 1000,
        specialDefense: 1000,
        speed: 1000,
      },
    };
    expect(attributes(oversized)).toEqual(
      attributes({
        ...oversized,
        stats: {
          hp: 10000,
          attack: 10000,
          defense: 10000,
          specialAttack: 10000,
          specialDefense: 10000,
          speed: 10000,
        },
      }),
    );
  });
  it("trades heavy-body strength for mobility and perimeter coverage", () => {
    const light = attributes({ ...fixture, weightKg: 30 }),
      heavy = attributes({ ...fixture, weightKg: 350 });
    expect(heavy.strength).toBeGreaterThan(light.strength);
    expect(heavy.speed).toBeLessThan(light.speed);
    expect(heavy.perimeterDefense).toBeLessThan(light.perimeterDefense);
    expect(heavy.rebounding).toBeGreaterThan(light.rebounding);
  });
  it("makes type traits modest and does not grant a legendary multiplier", () => {
    const neutral = attributes(fixture);
    let changed = false;
    for (const types of [...new Set(POKEMON.flatMap((p) => p.types))]
      .map((t) => [t])
      .concat([
        ["electric", "psychic"],
        ["rock", "ground"],
      ])) {
      const rated = attributes({ ...fixture, types });
      for (const key of Object.keys(neutral) as (keyof typeof neutral)[]) {
        expect(Math.abs(rated[key] - neutral[key])).toBeLessThanOrEqual(5);
        changed ||= Math.abs(rated[key] - neutral[key]) > 0;
      }
    }
    expect(changed).toBe(true);
    expect(attributes({ ...fixture, legendary: true })).toEqual(
      attributes({ ...fixture, legendary: false }),
    );
  });
  it("penalizes missing guard skills even on a strong physical player", () => {
    const goodGuard = {
      ...fixture,
      stats: {
        ...fixture.stats,
        specialAttack: 110,
        specialDefense: 110,
        speed: 110,
      },
    };
    const poorHandler = {
      ...goodGuard,
      stats: { ...goodGuard.stats, speed: 20 },
    };
    expect(
      positionRating(goodGuard, "PG") - positionRating(poorHandler, "PG"),
    ).toBeGreaterThan(8);
  });
  it("requires five starters and three bench players before a team is complete", () => {
    expect(teamRatings(emptyRoster())).toMatchObject({
      offense: 0,
      defense: 0,
      overall: 0,
      filled: 0,
      rosterFilled: 0,
      complete: false,
    });
    expect(teamRatings({ ...emptyRoster(), PG: 65 })).toMatchObject({
      filled: 1,
      rosterFilled: 1,
      complete: false,
    });
    expect(
      teamRatings({ ...strong, B1: null, B2: null, B3: null }),
    ).toMatchObject({ filled: 5, rosterFilled: 5, complete: false });
    expect(teamRatings(strong)).toMatchObject({
      filled: 5,
      rosterFilled: 8,
      complete: true,
    });
  });
  it("lets stronger reserves improve the same starting five", () => {
    const weakBench = { ...strong, B1: 129, B2: 10, B3: 13 };
    expect(teamRatings(strong).bench).toBeGreaterThan(
      teamRatings(weakBench).bench!,
    );
    expect(teamRatings(strong).overall).toBeGreaterThan(
      teamRatings(weakBench).overall,
    );
  });
  it("conserves 240 integer regulation minutes without overloading one player", () => {
    for (const rotation of ROTATIONS) {
      const minutes = rotationMinutes(strong, rotation);
      expect(Object.values(minutes).reduce((sum, n) => sum + n, 0)).toBe(240);
      for (const slot of ROSTER_SLOTS) {
        expect(Number.isInteger(minutes[slot])).toBe(true);
        expect(minutes[slot]).toBeGreaterThan(0);
        expect(minutes[slot]).toBeLessThanOrEqual(40);
      }
    }
    const starterMinutes = rotationMinutes(strong, "starters"),
      benchMinutes = rotationMinutes(strong, "bench");
    expect(
      POSITIONS.reduce((sum, p) => sum + starterMinutes[p], 0),
    ).toBeGreaterThan(POSITIONS.reduce((sum, p) => sum + benchMinutes[p], 0));
  });
  it("does not award minutes to empty or unknown roster slots", () => {
    expect(
      Object.values(rotationMinutes(emptyRoster())).every((n) => n === 0),
    ).toBe(true);
    const minutes = rotationMinutes({ ...emptyRoster(), PG: 65, B1: 999 });
    expect(minutes.PG).toBeGreaterThan(0);
    expect(minutes.PG).toBeLessThanOrEqual(40);
    expect(
      ROSTER_SLOTS.filter((s) => s !== "PG").every((s) => minutes[s] === 0),
    ).toBe(true);
  });
  it("makes coaching and roster balance affect the ratings", () => {
    expect(teamRatings(strong, "perimeter").offense).not.toBe(
      teamRatings(strong, "interior").offense,
    );
    expect(teamRatings(strong, "defense").defense).toBeGreaterThan(
      teamRatings(strong, "balanced").defense,
    );
    expect(teamRatings(strong, "balanced", "starters").overall).not.toBe(
      teamRatings(strong, "balanced", "bench").overall,
    );
    const ratings = teamRatings(strong);
    for (const key of [
      "spacing",
      "creation",
      "rimProtection",
      "chemistry",
    ] as const)
      expect(ratings[key]).toBeGreaterThan(0);
  });
});
