import { describe, it, expect } from "vitest";
import { createRun, placePokemon, autoFillBench } from "./draft";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS, POSITIONS } from "./types";
import { parseLineup, lineupLink } from "./lineup";
describe("eight-player roster", () => {
  it("requires all eight and excludes duplicate bench picks", () => {
    let s = initialState(77);
    for (const position of POSITIONS)
      s = gameReducer(s, {
        type: "PLACE",
        position,
        pokemonId: s.run.offerIds[0],
      });
    expect(gameReducer(s, { type: "SIMULATE" })).toBe(s);
    expect(s.run.offerIds).toHaveLength(4);
    const duplicate = gameReducer(s, {
      type: "PLACE",
      position: "B1",
      pokemonId: s.run.roster.PG!,
    });
    expect(duplicate).toBe(s);
    for (const position of ["B1", "B2", "B3"] as const)
      s = gameReducer(s, {
        type: "PLACE",
        position,
        pokemonId: s.run.offerIds[0],
      });
    expect(new Set(Object.values(s.run.roster)).size).toBe(8);
    expect(s.run.offerIds).toEqual([]);
  });
  it("fills only open free bench slots without changing starters", () => {
    let run = createRun("free", false, 2);
    run = placePokemon(run, 65, "PG");
    run = placePokemon(run, 143, "B1");
    const filled = autoFillBench(run);
    expect(filled.roster.PG).toBe(65);
    expect(filled.roster.B1).toBe(143);
    expect(filled.roster.SG).toBeNull();
    expect(filled.roster.B2).not.toBeNull();
    expect(autoFillBench(createRun("spin", true, 2)).roster.B1).toBeNull();
  });
  it("accepts old five-player links and shares all eight slots", () => {
    const legacy = parseLineup("?lineup=65,135,6,68,143")!;
    expect(legacy.B1).toBeNull();
    const roster = { ...legacy, B1: 9, B2: 94, B3: 59 };
    expect(
      parseLineup(new URL(lineupLink("https://example.com/", roster)).search),
    ).toEqual(roster);
    expect(parseLineup("?lineup=65,135,6,68,143,9,94,65")).toBeNull();
    expect(ROSTER_SLOTS).toHaveLength(8);
  });
});
