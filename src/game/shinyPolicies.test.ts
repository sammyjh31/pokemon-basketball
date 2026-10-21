import { describe, expect, it } from "vitest";
import { FRANCHISE_POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { createGame } from "./arcade/setup";
import type { ArcadeSetup } from "./arcade/types";
import { isShinyPokemon, shinyPokemon } from "./shiny";
import { playerProfile } from "./playerProfile";
import { movePool } from "./basketballMoves";
import { coachMoves } from "./movePolicy";
import { coachRosterFit } from "./coachOffice";
import { getCoach } from "./trainerCoaches";
import { playerPersonality } from "./playerPersonality";
import { emptyRoster, type LeagueTeam } from "./types";

const seedFor = (id: number) => {
  let seed = 0;
  while (!isShinyPokemon(id, seed)) seed++;
  return seed;
};
const setup = (): ArcadeSetup => ({
  teams: [
    {
      name: "Home",
      roster: { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, B1: 6, B2: 7, B3: 8 },
      development: { 1: { passing: 7 } },
    },
    {
      name: "Away",
      roster: { PG: 20, SG: 21, SF: 22, PF: 23, C: 24, B1: 25, B2: 26, B3: 27 },
    },
  ],
  seed: 12,
  chemistryVersion: 1,
});
describe("shiny skill profiles in playable games and core policies", () => {
  it.each([false, true])(
    "loads the shiny bonus into raw arcade and chemistry skills, with official=%s",
    (official) => {
      const input = setup();
      input.official = official;
      const mon = POKEMON_BY_ID.get(1)!;
      const ordinary = playerProfile(mon, input.teams[0].development?.[1]);
      const plain = createGame(input);
      const seeded = structuredClone(input);
      const seed = seedFor(1);
      seeded.teams.forEach((team) => {
        team.shinySeed = seed;
      });
      const shiny = createGame(seeded).players[0];
      const expected = playerProfile(
        shinyPokemon(mon, seed),
        input.teams[0].development?.[1],
      );
      expect(shiny.attributes).toEqual(expected.attributes);
      expect(shiny.chemistryProfile).toEqual(expected);
      expect(shiny.attributes.passing).toBeGreaterThan(
        plain.players[0].attributes.passing,
      );
      expect(playerProfile(mon, input.teams[0].development?.[1])).toBe(
        ordinary,
      );
      expect(createGame(input).players[0].attributes).toEqual(
        plain.players[0].attributes,
      );
    },
  );
  it("uses shiny skills for move eligibility while retaining the same species signatures", () => {
    const mon = FRANCHISE_POKEMON.find((p) => {
      const speed = playerProfile(p).attributes.speed;
      return (
        speed >= 62 &&
        speed < 65 &&
        !p.types.some((t) => ["electric", "psychic", "flying"].includes(t))
      );
    })!;
    expect(mon).toBeDefined();
    expect(movePool(mon.id).some((m) => m.id === "agility")).toBe(false);
    const seed = seedFor(mon.id);
    expect(movePool(mon.id, 1, seed).some((m) => m.id === "agility")).toBe(
      true,
    );
    expect(movePool(mon.id, 2, seed).filter((m) => m.signature)).toEqual(
      movePool(mon.id, 2).filter((m) => m.signature),
    );
  });
  it("uses the same shiny identity for coach skill fits and leaves personality identity intact", () => {
    const id = 65;
    const base: LeagueTeam = {
      id: 0,
      name: "Club",
      roster: { ...emptyRoster(), PG: id },
      tactic: "balanced",
      defense: "man",
      rotation: "balanced",
      ratings: {
        offense: 0,
        defense: 0,
        overall: 0,
        complete: false,
        filled: 1,
      },
      abilityVersion: 1,
      abilityMasteryVersion: 1,
      abilityMastery: { [id]: 400 },
      courtVersion: 3,
      movesetVersion: 1,
    };
    const seed = seedFor(id);
    const seeded = { ...base, shinySeed: seed };
    const personality = playerPersonality(id);
    expect(coachRosterFit(seeded, getCoach("oak")!)).toBeGreaterThan(
      coachRosterFit(base, getCoach("oak")!),
    );
    expect(coachMoves(seeded, id).projectedFit).toBeGreaterThan(
      coachMoves(base, id).projectedFit,
    );
    expect(playerPersonality(id)).toEqual(personality);
    expect(coachMoves(base, id)).toEqual(
      coachMoves({ ...base, shinySeed: undefined }, id),
    );
  });
});
