import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import {
  engineProfile,
  lineupChemistry,
  signatureImpact,
  type SignatureContext,
} from "./engineDepth";
import { playerProfile } from "./playerProfile";
import type { Pokemon } from "./types";
const source = POKEMON_BY_ID.get(65)!;
const mon = (heightM: number, weightKg: number): Pokemon => ({
  ...source,
  heightM,
  weightKg,
});

describe("physical and behavioral profiles", () => {
  it("adds diminishing reach and mass benefits with a real movement and fatigue tradeoff", () => {
    const small = engineProfile(mon(0.5, 20)).physical;
    const large = engineProfile(mon(3, 300)).physical;
    const huge = engineProfile(mon(30, 3000)).physical;
    const impossible = engineProfile(mon(300, 30000)).physical;
    expect(large.rebounding).toBeGreaterThan(small.rebounding);
    expect(large.screening).toBeGreaterThan(small.screening);
    expect(large.postContact).toBeGreaterThan(small.postContact);
    expect(large.agility).toBeLessThan(small.agility);
    expect(large.fatigue).toBeGreaterThan(small.fatigue);
    expect(impossible.rebounding - huge.rebounding).toBeLessThan(
      huge.rebounding - large.rebounding,
    );
    expect(impossible.rebounding).toBeLessThanOrEqual(6);
    expect(impossible.screening).toBeLessThanOrEqual(5);
    expect(impossible.agility).toBeGreaterThanOrEqual(-5.5);
    expect(impossible.fatigue).toBeLessThanOrEqual(0.28);
  });

  it("assigns individual shot preferences separately from identical base abilities", () => {
    const one = { ...source, id: 5001 },
      two = { ...source, id: 5002 };
    expect(playerProfile(one).attributes).toEqual(
      playerProfile(two).attributes,
    );
    expect(engineProfile(one).tendencies).not.toEqual(
      engineProfile(two).tendencies,
    );
    for (const p of POKEMON_BY_ID.values()) {
      const depth = engineProfile(p);
      expect(depth.tendencies.rim).toBeGreaterThanOrEqual(0.8);
      expect(depth.tendencies.three).toBeLessThanOrEqual(1.2);
      expect(depth.scouting).toContain("Signature:");
    }
  });

  it("requires complementary skills on distinct teammates and modestly rewards continuity", () => {
    const profile = playerProfile(source);
    const specialist = (
      passing: number,
      threePoint: number,
      finishing: number,
    ) => ({
      ...profile,
      attributes: { ...profile.attributes, passing, threePoint, finishing },
    });
    const complementary = [
      specialist(90, 30, 30),
      specialist(30, 90, 30),
      specialist(30, 30, 90),
    ];
    const singleStar = [
      specialist(90, 90, 90),
      specialist(30, 30, 30),
      specialist(30, 30, 30),
    ];
    expect(lineupChemistry(complementary, 0)).toBeGreaterThan(
      lineupChemistry(singleStar, 0),
    );
    expect(lineupChemistry(complementary, 1)).toBeGreaterThan(
      lineupChemistry(complementary, 0),
    );
    expect(lineupChemistry(complementary, 1)).toBeLessThanOrEqual(0.016);
    expect(lineupChemistry([], 0)).toBe(0);
  });

  it("keeps each signature small, conditional and completely disabled by the toggle", () => {
    const base: SignatureContext = {
      zone: "rim",
      play: "transition",
      clutch: false,
      secondChance: false,
      contested: true,
      energy: 100,
    };
    const electric = engineProfile({ ...source, types: ["electric"] });
    expect(signatureImpact(electric, "shooter", base, true)).toBeGreaterThan(0);
    expect(
      signatureImpact(
        electric,
        "shooter",
        { ...base, play: "isolation" },
        true,
      ),
    ).toBe(0);
    const steel = engineProfile({ ...source, types: ["steel"] });
    expect(signatureImpact(steel, "defender", base, true)).toBeLessThan(0);
    expect(
      signatureImpact(steel, "defender", { ...base, energy: 20 }, true),
    ).toBe(0);
    const psychic = engineProfile({ ...source, types: ["psychic"] });
    expect(
      signatureImpact(psychic, "passer", { ...base, play: "pickRoll" }, true),
    ).toBeGreaterThan(0);
    for (const p of POKEMON_BY_ID.values())
      for (const role of ["shooter", "passer", "defender"] as const) {
        const profile = engineProfile(p);
        expect(
          Math.abs(
            signatureImpact(
              profile,
              role,
              { ...base, clutch: true, secondChance: true },
              true,
            ),
          ),
        ).toBeLessThanOrEqual(0.012);
        expect(signatureImpact(profile, role, base, false)).toBe(0);
      }
  });
});

it("applies body size to rebound opportunities even when basketball ratings are held identical", async () => {
  const { simulateMatch } = await import("./match");
  const { teamRatings } = await import("./ratings");
  const { ROSTER_SLOTS } = await import("./types");
  const ids = Array.from({ length: 8 }, (_, i) => 6001 + i);
  const opponentIds = [65, 135, 149, 68, 143, 121, 6, 131];
  const reference = playerProfile(source);
  const rules = {
    version: 1 as const,
    abilities: false,
    adaptiveCoaching: false,
    familiarity: 0,
  };
  const team = (id: number, list: number[]) => {
    const roster = Object.fromEntries(
      ROSTER_SLOTS.map((s, i) => [s, list[i]]),
    ) as import("./types").Roster;
    return {
      id,
      name: String(id),
      roster,
      tactic: "balanced" as const,
      rotation: "balanced" as const,
      defense: "man" as const,
      ratings: teamRatings(roster),
      simulationVersion: 2 as const,
      engineRules: rules,
    };
  };
  const total = (heightM: number, weightKg: number) => {
    for (const id of ids) {
      const pokemon = { ...source, id, heightM, weightKg };
      POKEMON_BY_ID.set(id, pokemon);
      const p = playerProfile(pokemon);
      p.attributes = { ...reference.attributes };
      p.positions = { ...reference.positions };
      p.traits = { ...reference.traits };
    }
    let rebounds = 0,
      chances = 0;
    for (let seed = 8000; seed < 8200; seed++) {
      const game = simulateMatch(team(0, ids), team(1, opponentIds), seed);
      const offensive = game.homeBox.reduce(
        (n, p) => n + p.offensiveRebounds,
        0,
      );
      rebounds += offensive;
      chances +=
        offensive + game.awayBox.reduce((n, p) => n + p.defensiveRebounds, 0);
    }
    return rebounds / chances;
  };
  try {
    expect(total(3, 300)).toBeGreaterThan(total(0.5, 15) + 0.005);
  } finally {
    for (const id of ids) POKEMON_BY_ID.delete(id);
  }
});
