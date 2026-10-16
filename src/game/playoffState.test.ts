import { beforeAll, describe, expect, it } from "vitest";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";
import type { Playoffs } from "./playoffTypes";

let finished: GameState;
beforeAll(() => {
  let state = initialState(47);
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  finished = gameReducer(state, { type: "SIMULATE" });
}, 60000);

const playoffs: Playoffs = {
  modelVersion: 1,
  seeds: [],
  series: [],
  players: [],
  finalsPlayers: [],
  championId: null,
  finalsMvp: null,
};

describe("postseason run state", () => {
  it("applies playoffs once to the current completed league without recounting the regular season", () => {
    const applied = gameReducer(finished, {
      type: "APPLY_PLAYOFFS",
      source: finished.run,
      playoffs,
    });
    expect(applied.run.playoffs).toBe(playoffs);
    expect(applied.run.result).toBe(finished.run.result);
    expect(applied.records).toBe(finished.records);
    expect(
      gameReducer(applied, {
        type: "APPLY_PLAYOFFS",
        source: finished.run,
        playoffs,
      }),
    ).toBe(applied);
  });

  it("rejects stale playoff work after a replacement run", () => {
    const replacement = gameReducer(finished, {
      type: "NEW_RUN",
      mode: "spin",
      includeLegends: true,
      seed: 48,
    });
    expect(
      gameReducer(replacement, {
        type: "APPLY_PLAYOFFS",
        source: finished.run,
        playoffs,
      }),
    ).toBe(replacement);
    expect(replacement.run.playoffs).toBeUndefined();
  });

  it("requires a completed model-3 league", () => {
    for (const state of [
      initialState(48),
      {
        ...finished,
        run: {
          ...finished.run,
          result: { ...finished.run.result!, modelVersion: 2 as const },
        },
      },
      {
        ...finished,
        run: {
          ...finished.run,
          result: { ...finished.run.result!, league: undefined },
        },
      },
    ]) {
      expect(
        gameReducer(state, {
          type: "APPLY_PLAYOFFS",
          source: state.run,
          playoffs,
        }),
      ).toBe(state);
    }
  });
});
