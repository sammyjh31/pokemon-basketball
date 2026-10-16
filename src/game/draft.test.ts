import { describe, expect, it } from "vitest";
import { createRun, placePokemon, reroll, swapPositions } from "./draft";
import { ROSTER_SLOTS, type Run } from "./types";
import { POKEMON_BY_ID } from "../data/pokemon";

describe("draft rules", () => {
  it("offers four distinct eligible Pokémon reproducibly across 200 seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      let run = createRun("spin", false, seed);
      expect(run).toEqual(createRun("spin", false, seed));
      expect(run.rerollsLeft).toBe(2);
      for (const position of ROSTER_SLOTS) {
        expect(new Set(run.offerIds).size).toBe(4);
        expect(
          run.offerIds.every(
            (id) =>
              !POKEMON_BY_ID.get(id)!.legendary &&
              !Object.values(run.roster).includes(id),
          ),
        ).toBe(true);
        run = placePokemon(run, run.offerIds[0], position);
      }
      expect(new Set(Object.values(run.roster)).size).toBe(8);
      expect(run.offerIds).toEqual([]);
    }
  });
  it("permits exactly two rerolls without changing the season stream", () => {
    const original = createRun("spin", true, 77);
    const first = reroll(original);
    const second = reroll(first);
    expect(first.rerollsLeft).toBe(1);
    expect(second.rerollsLeft).toBe(0);
    expect(reroll(second)).toBe(second);
    expect(second.seasonSeed).toBe(original.seasonSeed);
  });
  it("locks spin placements and rejects unoffered, duplicate or unknown choices", () => {
    const run = createRun("spin", true, 32);
    const id = run.offerIds[0];
    const picked = placePokemon(run, id, "PG");
    expect(placePokemon(run, 1026, "PG")).toBe(run);
    expect(placePokemon(picked, picked.offerIds[0], "PG")).toBe(picked);
    expect(placePokemon(picked, id, "SG")).toBe(picked);
    expect(swapPositions(picked, "PG", "C")).toBe(picked);
    const missing = Array.from({ length: 151 }, (_, i) => i + 1).find(
      (id) => !run.offerIds.includes(id),
    )!;
    expect(placePokemon(run, missing, "PG")).toBe(run);
  });
  it("supports replacement and swaps in free draft without duplicates", () => {
    let run = createRun("free", false, 1);
    expect(run.offerIds).toEqual([]);
    expect(placePokemon(run, 150, "PG")).toBe(run);
    expect(placePokemon(run, 252, "PG")).toBe(run);
    run = placePokemon(run, 65, "PG");
    run = placePokemon(run, 143, "C");
    expect(placePokemon(run, 65, "SF")).toBe(run);
    run = swapPositions(run, "PG", "C");
    expect(run.roster).toMatchObject({ PG: 143, C: 65 });
    run = placePokemon(run, 25, "PG");
    expect(run.roster.PG).toBe(25);
    expect(reroll(run)).toBe(run);
  });
  it("rejects all edits after a season", () => {
    const run = {
      ...createRun("free", true, 1),
      result: { games: [], wins: 0, losses: 0, mvpId: 1 },
    } as Run;
    expect(placePokemon(run, 25, "PG")).toBe(run);
    expect(swapPositions(run, "PG", "C")).toBe(run);
    expect(reroll(run)).toBe(run);
  });
});
