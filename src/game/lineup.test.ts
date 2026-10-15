import { describe, expect, it } from "vitest";
import { parseLineup, lineupLink, randomLineup } from "./lineup";
import { gameReducer, initialState } from "./state";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { Roster } from "./types";

const roster: Roster = { PG: 65, SG: 135, SF: 6, PF: 68, C: 143 };
describe("shareable basketball lineups", () => {
  it("round-trips the five positions and empty slots without unrelated URL parameters", () => {
    const link = lineupLink("https://example.com/?tracking=123#season", {
      ...roster,
      C: null,
    });
    expect(link).toBe("https://example.com/?lineup=65,135,6,68,0");
    expect(parseLineup(new URL(link).search)).toEqual({ ...roster, C: null });
  });
  it("rejects malformed, duplicate, unknown and incomplete links", () => {
    for (const value of [
      "1,2",
      "1,2,3,4,4",
      "1,2,3,4,152",
      "1,2,3,4,NaN",
      "1,2,3,4,1.5",
      "-1,2,3,4,5",
    ])
      expect(parseLineup(`?lineup=${value}`)).toBeNull();
    expect(parseLineup("")).toBeNull();
    expect(parseLineup("?lineup=0,0,0,0,0")).toEqual({
      PG: null,
      SG: null,
      SF: null,
      PF: null,
      C: null,
    });
  });
  it("randomizes into five unique eligible Pokémon and is reproducible", () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = Object.values(randomLineup(false, seed));
      expect(new Set(ids).size).toBe(5);
      expect(ids.every((id) => id && !POKEMON_BY_ID.get(id)!.legendary)).toBe(
        true,
      );
    }
    expect(randomLineup(true, 42)).toEqual(randomLineup(true, 42));
  });
  it("edits only unfinished free lineups, preserving history and rejecting invalid rosters", () => {
    const spin = initialState(1);
    expect(gameReducer(spin, { type: "SET_LINEUP", roster })).toBe(spin);
    const free = gameReducer(spin, {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: false,
      seed: 2,
    });
    const changed = gameReducer(free, { type: "SET_LINEUP", roster });
    expect(changed.run.roster).toEqual(roster);
    expect(changed.records).toEqual(free.records);
    for (const invalid of [
      { ...roster, C: 65 },
      { ...roster, C: 150 },
      { ...roster, C: 999 },
    ])
      expect(gameReducer(free, { type: "SET_LINEUP", roster: invalid })).toBe(
        free,
      );
    const finished = gameReducer(changed, { type: "SIMULATE" });
    expect(gameReducer(finished, { type: "SET_LINEUP", roster })).toBe(
      finished,
    );
  });
});
