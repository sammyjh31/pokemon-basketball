import { beforeAll, describe, expect, it } from "vitest";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";
import {
  loadGame,
  prepareGameLoad,
  STORAGE_KEY,
  type StorageLike,
} from "./persistence";
import { createPlayoffs, simulatePlayoffs } from "./playoffs";

const memory = (value: string): StorageLike => ({
  getItem: () => value,
  setItem: (_key, next) => {
    value = next;
  },
});
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

describe("saved postseason recovery", () => {
  it("keeps existing model-3 completed seasons ready to begin playoffs", () => {
    const loaded = loadGame(memory(JSON.stringify(finished)), 999);
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(finished);
    expect(loaded.state.run.playoffs).toBeUndefined();
    expect(
      createPlayoffs(
        loaded.state.run.result!.league!,
        loaded.state.run.seasonSeed,
      ).seeds,
    ).toHaveLength(16);
  });

  it.each(["game", "all"] as const)(
    "round-trips %s playoff progress without changing regular-season history",
    (mode) => {
      const playoffs = simulatePlayoffs(
        finished.run.result!.league!,
        finished.run.seasonSeed,
        undefined,
        mode,
      );
      const saved = { ...finished, run: { ...finished.run, playoffs } };
      const loaded = loadGame(memory(JSON.stringify(saved)), 999);
      expect(loaded.notice).toBeNull();
      expect(loaded.state).toEqual(saved);
      expect(loaded.state.records).toEqual(finished.records);
      expect(loaded.state.run.result).toEqual(finished.run.result);
      if (mode === "game") {
        expect(
          loaded.state.run.playoffs!.series.reduce(
            (count, series) => count + series.games.length,
            0,
          ),
        ).toBe(8);
        expect(loaded.state.run.playoffs!.championId).toBeNull();
      } else {
        expect(loaded.state.run.playoffs!.championId).not.toBeNull();
        expect(loaded.state.run.playoffs!.finalsMvp).not.toBeNull();
      }
    },
    60000,
  );

  it("recovers the completed regular season when only its playoff extension is invalid", () => {
    const source = JSON.stringify(
      { ...finished, run: { ...finished.run, playoffs: { modelVersion: 99 } } },
      null,
      2,
    );
    const storage = memory(source);
    const loaded = loadGame(storage, 999);
    expect(loaded.state).toEqual(finished);
    expect(loaded.notice).toMatch(/playoff/i);
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  });

  it("restores and verifies the regular season before recovering damaged playoffs", async () => {
    const source = JSON.stringify(
      { ...finished, run: { ...finished.run, playoffs: null } },
      null,
      2,
    );
    const storage = memory(source);
    const prepared = prepareGameLoad(storage, 999);
    expect(prepared.state.run.result).toBeNull();
    const loaded = await prepared.restore!(
      () => {},
      new AbortController().signal,
    );
    expect(loaded.state).toEqual(finished);
    expect(loaded.notice).toMatch(/playoff/i);
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  }, 60000);

  it("retains playoff progress after deferred regular-season restoration", async () => {
    const playoffs = simulatePlayoffs(
      finished.run.result!.league!,
      finished.run.seasonSeed,
      undefined,
      "round",
    );
    const saved = { ...finished, run: { ...finished.run, playoffs } };
    const prepared = prepareGameLoad(memory(JSON.stringify(saved)), 999);
    const loaded = await prepared.restore!(
      () => {},
      new AbortController().signal,
    );
    expect(loaded.state).toEqual(saved);
    expect(loaded.notice).toBeNull();
  }, 60000);

  it.each([
    "score",
    "future matchup",
    "player total",
    "Finals MVP",
    "too many games",
  ] as const)(
    "rejects a corrupted %s extension while retaining the regular season",
    (kind) => {
      const playoffs = simulatePlayoffs(
        finished.run.result!.league!,
        finished.run.seasonSeed,
        undefined,
        kind === "Finals MVP" ? "all" : "game",
      );
      if (kind === "score") playoffs.series[0].games[0].homeScore += 1;
      if (kind === "future matchup") playoffs.series[8].higherSeedId = 999;
      if (kind === "player total") playoffs.players[0].points += 1;
      if (kind === "Finals MVP") playoffs.finalsMvp!.pokemonId = 999;
      if (kind === "too many games")
        playoffs.series[0].games = Array(106).fill(playoffs.series[0].games[0]);
      const source = JSON.stringify({
        ...finished,
        run: { ...finished.run, playoffs },
      });
      const loaded = loadGame(memory(source), 999);
      expect(loaded.state).toEqual(finished);
      expect(loaded.notice).toMatch(/playoff/i);
      expect(loaded.preserveSource).toBe(true);
    },
    60000,
  );
});
