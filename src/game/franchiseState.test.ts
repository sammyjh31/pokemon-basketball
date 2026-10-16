import { describe, expect, it } from "vitest";
import { gameReducer, initialState } from "./state";
import { createLeague } from "./league";
import { ROSTER_SLOTS, type GameState, type SeasonResult } from "./types";
function preseason(): GameState {
  let state = initialState(77);
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  const teams = createLeague(state.run);
  return {
    ...state,
    run: { ...state.run, leagueTeams: teams },
    franchise: {
      modelVersion: 1,
      year: 2,
      phase: "season",
      teams,
      careers: [],
      history: [],
      trades: [],
    },
  };
}
describe("franchise reducer boundaries", () => {
  it("allows coaching and swaps for a spin-origin franchise but blocks replacing members", () => {
    const state = preseason();
    const swapped = gameReducer(state, {
      type: "SWAP",
      first: "PG",
      second: "B1",
    });
    expect(swapped.run.roster.PG).toBe(state.run.roster.B1);
    expect(swapped.run.roster.B1).toBe(state.run.roster.PG);
    expect(swapped.run.mode).toBe("spin");
    expect(
      gameReducer(state, { type: "TACTIC", tactic: "pace" }).run.tactic,
    ).toBe("pace");
    expect(
      gameReducer(state, { type: "DEFENSE", defense: "zone" }).run.defense,
    ).toBe("zone");
    expect(
      gameReducer(state, { type: "ROTATION", rotation: "bench" }).run.rotation,
    ).toBe("bench");
    for (const action of [
      { type: "PLACE", pokemonId: 1, position: "PG" },
      { type: "SET_LINEUP", roster: state.run.roster },
      { type: "AUTO_BENCH" },
      { type: "REROLL" },
    ] as const)
      expect(gameReducer(state, action)).toBe(state);
  });
  it("does not count franchise seasons as fresh challenge attempts or apply stale seasons", () => {
    const state = preseason();
    const result: SeasonResult = {
      modelVersion: 4,
      wins: 82,
      losses: 0,
      games: [],
      mvpId: 1,
    };
    expect(
      gameReducer(state, {
        type: "APPLY_SEASON",
        source: { ...state.run },
        result,
      }),
    ).toBe(state);
    const applied = gameReducer(state, {
      type: "APPLY_SEASON",
      source: state.run,
      result,
    });
    expect(applied.run.result).toBe(result);
    expect(applied.records).toBe(state.records);
    expect(
      gameReducer(applied, {
        type: "APPLY_SEASON",
        source: applied.run,
        result,
      }),
    ).toBe(applied);
  });
  it("explicitly ends the franchise when starting a fresh draft", () => {
    const state = preseason();
    const fresh = gameReducer(state, {
      type: "NEW_RUN",
      mode: "free",
      includeLegends: false,
      seed: 456,
    });
    expect(fresh.franchise).toBeUndefined();
    expect(fresh.run.leagueTeams).toBeUndefined();
    expect(fresh.run.result).toBeNull();
    expect(fresh.records).toBe(state.records);
  });
});
