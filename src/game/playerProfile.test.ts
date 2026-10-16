import { describe, expect, it } from "vitest";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { attributes } from "./ratings";
import { playerProfile } from "./playerProfile";

describe("basketball scouting profiles", () => {
  it("adds bounded role skills without changing the original twenty attributes", () => {
    for (const mon of POKEMON) {
      const profile = playerProfile(mon);
      expect(profile.attributes).toEqual(attributes(mon));
      expect(
        Object.values(profile.traits).every(
          (n) => Number.isFinite(n) && n >= 0 && n <= 100,
        ),
      ).toBe(true);
      expect(profile.strengths.length).toBeGreaterThan(0);
      expect(profile.scouting.length).toBeGreaterThan(20);
    }
  });

  it("distinguishes interior screens from perimeter decision making", () => {
    const alakazam = playerProfile(POKEMON_BY_ID.get(65)!);
    const snorlax = playerProfile(POKEMON_BY_ID.get(143)!);
    expect(snorlax.traits.screening).toBeGreaterThan(alakazam.traits.screening);
    expect(snorlax.traits.postGame).toBeGreaterThan(alakazam.traits.postGame);
    expect(alakazam.traits.decisionMaking).toBeGreaterThan(
      snorlax.traits.decisionMaking,
    );
    expect(alakazam.traits.offBall).toBeGreaterThan(snorlax.traits.offBall);
  });

  it("does not reuse stale profiles for a new Pokémon object with changed skills", () => {
    const mon = POKEMON_BY_ID.get(65)!;
    const trained = { ...mon, stats: { ...mon.stats, specialDefense: 200 } };
    expect(playerProfile(trained).traits.discipline).toBeGreaterThan(
      playerProfile(mon).traits.discipline,
    );
  });
});
