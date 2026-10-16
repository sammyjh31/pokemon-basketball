import { describe, expect, it } from "vitest";
import { initialState, gameReducer } from "./state";
import { ROSTER_SLOTS } from "./types";
export function completedState() {
  let state = initialState(14);
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      pokemonId: state.run.offerIds[0],
      position,
    });
  return gameReducer(state, { type: "SIMULATE" });
}
describe("run state", () => {
  it("blocks simulation until all eight players are drafted", () => {
    const s = initialState(1);
    expect(gameReducer(s, { type: "SIMULATE" })).toBe(s);
  });
  it("records a season once and locks all roster edits", () => {
    const s = completedState();
    expect(s.run.result?.games).toHaveLength(82);
    expect(s.records.spin.runs).toBe(1);
    expect(s.records.free.runs).toBe(0);
    expect(gameReducer(s, { type: "SIMULATE" })).toBe(s);
    expect(
      gameReducer(s, { type: "PLACE", pokemonId: 25, position: "PG" }),
    ).toBe(s);
    expect(gameReducer(s, { type: "SWAP", first: "PG", second: "C" })).toBe(s);
    expect(gameReducer(s, { type: "REROLL" })).toBe(s);
  });
  it("starts a fresh draft while preserving mode-specific records", () => {
    const s = completedState(),
      next = gameReducer(s, {
        type: "NEW_RUN",
        mode: "free",
        includeLegends: false,
        seed: 99,
      });
    expect(next.records).toEqual(s.records);
    expect(next.run.result).toBeNull();
    expect(Object.values(next.run.roster)).toEqual([
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
    expect(next.run.mode).toBe("free");
  });
});

it("applies an asynchronous result only to its unchanged source run, once", () => {
  const source = initialState(4);
  source.run.mode = "free";
  source.run.offerIds = [];
  source.run.roster = {
    PG: 65,
    SG: 135,
    SF: 149,
    PF: 68,
    C: 143,
    B1: 121,
    B2: 6,
    B3: 131,
  };
  const result = {
    modelVersion: 3 as const,
    games: [],
    wins: 40,
    losses: 42,
    mvpId: 65,
  };
  const edited = gameReducer(source, { type: "DEFENSE", defense: "zone" });
  expect(
    gameReducer(edited, { type: "APPLY_SEASON", source: source.run, result }),
  ).toBe(edited);
  const applied = gameReducer(source, {
    type: "APPLY_SEASON",
    source: source.run,
    result,
  });
  expect(applied.records.free.runs).toBe(1);
  expect(applied.run.result).toBe(result);
  expect(
    gameReducer(applied, { type: "APPLY_SEASON", source: source.run, result }),
  ).toBe(applied);
});
