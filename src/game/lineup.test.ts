import { describe, expect, it } from "vitest";
import { parseLineup, lineupLink, randomLineup } from "./lineup";
import { gameReducer, initialState } from "./state";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { Roster } from "./types";

const roster: Roster = {
  PG: 65,
  SG: 135,
  SF: 6,
  PF: 68,
  C: 143,
  B1: 9,
  B2: 94,
  B3: 59,
};
describe("shareable basketball lineups", () => {
  it("round-trips the eight positions and empty slots without unrelated URL parameters", () => {
    const link = lineupLink("https://example.com/?tracking=123#season", {
      ...roster,
      C: null,
    });
    expect(link).toBe("https://example.com/?lineup=65,135,6,68,0,9,94,59");
    expect(parseLineup(new URL(link).search)).toEqual({ ...roster, C: null });
  });
  it("rejects malformed, duplicate, unknown and incomplete links", () => {
    for (const value of [
      "1,2",
      "1,2,3,4,4",
      "1,2,3,4,1026",
      "1,2,3,4,NaN",
      "1,2,3,4,1.5",
      "-1,2,3,4,5",
    ])
      expect(parseLineup(`?lineup=${value}`)).toBeNull();
    expect(parseLineup("")).toBeNull();
    // An all-empty link would replace a draft with nothing.
    expect(parseLineup("?lineup=0,0,0,0,0")).toBeNull();
    expect(parseLineup("?lineup=0,0,0,0,0,0,0,0")).toBeNull();
    expect(parseLineup("?lineup=0,0,0,0,25")).toEqual({
      PG: null,
      SG: null,
      SF: null,
      PF: null,
      C: 25,
      B1: null,
      B2: null,
      B3: null,
    });
  });
  it("keeps later generations in franchise rookie drafts, outside fresh lineup imports", () => {
    expect(parseLineup("?lineup=252,135,6,68,143,9,94,59")).toBeNull();
    const free = gameReducer(initialState(1), {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: true,
      seed: 2,
    });
    expect(
      gameReducer(free, { type: "SET_LINEUP", roster: { ...roster, PG: 252 } }),
    ).toBe(free);
  });
  it("randomizes into eight unique eligible Pokémon and is reproducible", () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = Object.values(randomLineup(false, seed));
      expect(new Set(ids).size).toBe(8);
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
      { ...roster, C: 252 },
      { ...roster, C: 1026 },
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
