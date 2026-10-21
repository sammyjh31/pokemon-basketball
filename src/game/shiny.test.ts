import { describe, expect, it, vi } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { attributes, teamRatings } from "./ratings";
import {
  isShinyPokemon,
  shinyPokemon,
  SHINY_ODDS,
  SHINY_SKILL_BONUS,
} from "./shiny";
import { playerProfile } from "./playerProfile";
import { createEvaluationContext, evaluatePlayer } from "./teamEvaluation";
import { emptyRoster } from "./types";

const mon = POKEMON_BY_ID.get(25)!;
const seed = () => {
  for (let n = 0; n < 100000; n++) if (isShinyPokemon(mon.id, n)) return n;
  throw new Error("No rare seed found");
};
describe("seeded rare shinies", () => {
  it("never upgrades legacy games and never uses a fresh random roll on refresh", () => {
    expect(isShinyPokemon(25)).toBe(false);
    expect(shinyPokemon(mon)).toBe(mon);
    const random = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Must stay seeded");
    });
    try {
      const first = shinyPokemon(mon, seed());
      expect(first.shiny).toBe(true);
      expect(shinyPokemon(mon, seed())).toBe(first);
      expect(first.id).toBe(mon.id);
      expect(mon.shiny).toBeUndefined();
    } finally {
      random.mockRestore();
    }
  });
  it("stays very rare across a large deterministic seed sample", () => {
    let count = 0;
    for (let n = 0; n < 100000; n++) count += Number(isShinyPokemon(25, n));
    expect(SHINY_ODDS).toBe(1024);
    expect(count).toBeGreaterThan(60);
    expect(count).toBeLessThan(140);
    for (const invalid of [-1, 1.5, NaN, Infinity, 0x100000000])
      expect(isShinyPokemon(25, invalid)).toBe(false);
  });
  it("adds exactly three capped points to basketball skills without changing the catalog or development", () => {
    const variant = shinyPokemon(mon, seed());
    const normal = attributes(mon, { speed: 2 });
    const shiny = attributes(variant, { speed: 2 });
    expect(SHINY_SKILL_BONUS).toBe(3);
    for (const key of Object.keys(normal) as (keyof typeof normal)[])
      expect(shiny[key]).toBeCloseTo(Math.min(100, normal[key] + 3), 8);
    expect(variant.stats).toEqual(mon.stats);
    expect(
      attributes(shinyPokemon(mon, seed()), { speed: 30 }).speed,
    ).toBeLessThanOrEqual(100);
    expect(playerProfile(variant).attributes.speed).toBeGreaterThan(
      playerProfile(mon).attributes.speed,
    );
    expect(attributes(mon)).toEqual(attributes(POKEMON_BY_ID.get(25)!));
  });
  it("uses the same bonus in team strengths and CPU recruiting evaluations", () => {
    const roster = { ...emptyRoster(), PG: 25 };
    const normal = teamRatings(roster);
    const shiny = teamRatings(
      roster,
      "balanced",
      "balanced",
      undefined,
      undefined,
      seed(),
    );
    expect(shiny.overall).toBeGreaterThan(normal.overall);
    const base = {
      roster,
      tactic: "balanced" as const,
      defense: "man" as const,
    };
    const normalPick = evaluatePlayer(createEvaluationContext(base), 25, "PG");
    const shinyPick = evaluatePlayer(
      createEvaluationContext({ ...base, shinySeed: seed() }),
      25,
      "PG",
    );
    expect(shinyPick.talent).toBeGreaterThan(normalPick.talent);
  });
});
