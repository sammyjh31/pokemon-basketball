import { describe, expect, it } from "vitest";
import { initialState, gameReducer } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";
import {
  loadGame,
  prepareGameLoad,
  saveGame,
  STORAGE_KEY,
  type StorageLike,
} from "./persistence";
const memory = (value: string | null = null): StorageLike => ({
  getItem: () => value,
  setItem: (_key, next) => {
    value = next;
  },
});
const finished = () => {
  let s = initialState(123);
  for (const position of ROSTER_SLOTS)
    s = gameReducer(s, {
      type: "PLACE",
      position,
      pokemonId: s.run.offerIds[0],
    });
  return gameReducer(s, { type: "SIMULATE" });
};
describe("saved progress", () => {
  it("round-trips an in-progress draft and completed season without recounting it", () => {
    for (const state of [initialState(1), finished()]) {
      const storage = memory();
      expect(saveGame(storage, state).saved).toBe(true);
      const loaded = loadGame(storage, 2);
      expect(loaded.state).toEqual(state);
      expect(loaded.notice).toBeNull();
    }
    const s = finished(),
      loaded = loadGame(memory(JSON.stringify(s)), 1).state;
    expect(gameReducer(loaded, { type: "SIMULATE" }).records.spin.runs).toBe(1);
  }, 20000); // Multiple full-league generations and validation replays.

  it("starts clean when there is no save", () => {
    expect(loadGame(memory(), 17)).toEqual({
      state: initialState(17),
      notice: null,
    });
  });
  it.each([
    [
      "unknown version",
      (s: GameState) => {
        (s as { version: number }).version = 99;
      },
    ],
    [
      "unknown id",
      (s: GameState) => {
        s.run.roster.PG = 1026;
      },
    ],
    [
      "duplicate roster",
      (s: GameState) => {
        s.run.roster.PG = 25;
        s.run.roster.SG = 25;
      },
    ],
    [
      "negative rerolls",
      (s: GameState) => {
        s.run.rerollsLeft = -1;
      },
    ],
    [
      "invalid seed",
      (s: GameState) => {
        s.run.seasonSeed = -1;
      },
    ],
    [
      "duplicate offer",
      (s: GameState) => {
        s.run.offerIds[1] = s.run.offerIds[0];
      },
    ],
    [
      "taken offer",
      (s: GameState) => {
        s.run.roster.PG = s.run.offerIds[0];
      },
    ],
    [
      "invalid record",
      (s: GameState) => {
        s.records.spin.perfectSeasons = 2;
      },
    ],
  ] as const)("rejects %s instead of trusting parsed JSON", (_name, mutate) => {
    const state = initialState(1);
    mutate(state);
    const loaded = loadGame(memory(JSON.stringify(state)), 22);
    expect(loaded.state).toEqual(initialState(22));
    expect(loaded.notice).toBeTruthy();
  });
  it.each(["truncated", "score", "totals", "mvp", "award"] as const)(
    "rejects inconsistent %s results",
    (kind) => {
      const state = finished();
      const result = state.run.result!;
      if (kind === "truncated") result.games.pop();
      if (kind === "score")
        result.games[0].teamScore = result.games[0].opponentScore;
      if (kind === "totals") result.wins += 1;
      if (kind === "mvp") result.mvpId = 999;
      if (kind === "award") result.games[0].playerOfGameId = 999;
      expect(loadGame(memory(JSON.stringify(state)), 3).notice).toBeTruthy();
    },
  );
  it("handles malformed JSON and blocked/quota-exceeded storage without throwing", () => {
    expect(loadGame(memory("{oops"), 1).notice).toBeTruthy();
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(loadGame(blocked, 4).state).toEqual(initialState(4));
    expect(loadGame(blocked, 4).notice).toBeTruthy();
    expect(saveGame(blocked, initialState(4))).toMatchObject({ saved: false });
  });
});

it("defers a completed league replay and stops before playing more games when cancelled", async () => {
  const saved = finished();
  const source = JSON.stringify(saved, null, 2);
  const storage = memory(source);
  const prepared = prepareGameLoad(storage, 18);
  expect(prepared.state.run.result).toBeNull();
  expect(prepared.state.records).toEqual(saved.records);
  expect(storage.getItem(STORAGE_KEY) === source).toBe(true);
  const controller = new AbortController();
  const progress: number[] = [];
  const pending = prepared.restore!((completed) => {
    progress.push(completed);
    if (completed === 15) controller.abort();
  }, controller.signal);
  await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  expect(progress).toEqual([0, 15]);
  expect(storage.getItem(STORAGE_KEY) === source).toBe(true);
}, 20000);
