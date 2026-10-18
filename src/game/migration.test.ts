import { describe, it, expect } from "vitest";
import { initialState, gameReducer } from "./state";
import { simulateSeason as legacySeason } from "./legacySeason";
import { loadGame, saveGame, STORAGE_KEY } from "./persistence";
import { simulateSeason as v2Season } from "./v2Season";
import { ROSTER_SLOTS } from "./types";
const storageMap = () => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};
const legacy = () => {
  const state = initialState(11);
  state.run.roster = {
    PG: 65,
    SG: 135,
    SF: 6,
    PF: 68,
    C: 143,
    B1: null,
    B2: null,
    B3: null,
  };
  state.run.mode = "free";
  state.run.offerIds = [];
  const result = legacySeason(state.run);
  return {
    ...state,
    version: 1,
    run: {
      ...state.run,
      roster: { PG: 65, SG: 135, SF: 6, PF: 68, C: 143 },
      result,
    },
    records: {
      ...state.records,
      free: {
        runs: 1,
        bestWins: result.wins,
        perfectSeasons: Number(result.wins === 82),
      },
    },
  };
};
describe("save model migration", () => {
  it("preserves current choices and draft randomness in a partial v1 challenge", () => {
    const original = initialState(12);
    original.run.offerIds = [25, 65, 68, 143];
    const old = {
      ...original,
      version: 1,
      run: {
        ...original.run,
        roster: { PG: null, SG: null, SF: null, PF: null, C: null },
      },
    };
    const storage = storageMap();
    storage.setItem("pokemon-basketball:v1", JSON.stringify(old));
    const loaded = loadGame(storage, 99);
    expect(loaded.notice).toBeNull();
    expect(loaded.state.run.offerIds).toEqual(original.run.offerIds);
    expect(loaded.state.run.draftSeed).toBe(original.run.draftSeed);
  });

  it("keeps completed v1 scores and records without inventing player stats or overwriting the old key", () => {
    const old = legacy(),
      storage = storageMap();
    storage.setItem("pokemon-basketball:v1", JSON.stringify(old));
    const loaded = loadGame(storage, 99);
    expect(loaded.notice).toBeNull();
    expect(loaded.state.version).toBe(3);
    expect(loaded.state.run.result?.games).toEqual(old.run.result.games);
    expect(loaded.state.records).toEqual(old.records);
    expect(loaded.state.run.result?.modelVersion).toBe(1);
    expect(loaded.state.run.result?.playerStats).toBeUndefined();
    expect(loaded.state.run.roster.B1).toBeNull();
    saveGame(storage, loaded.state);
    expect(storage.getItem("pokemon-basketball:v1")).toBe(JSON.stringify(old));
    expect(loadGame(storage, 88).state).toEqual(loaded.state);
  });
  it("restores a full old challenge with bench offers", () => {
    const old = legacy();
    old.run.mode = "spin";
    old.run.result = null as never;
    old.records = initialState(1).records;
    const storage = storageMap();
    storage.setItem("pokemon-basketball:v1", JSON.stringify(old));
    const loaded = loadGame(storage, 99);
    expect(loaded.notice).toBeNull();
    expect(loaded.state.run.offerIds).toHaveLength(4);
    expect(loaded.state.run.roster.PG).toBe(65);
    expect(loaded.state.run.roster.B1).toBeNull();
  });
  it("detects tampered v3 player totals, minutes and awards", () => {
    let state = initialState(11);
    for (const position of ROSTER_SLOTS)
      state = gameReducer(state, {
        type: "PLACE",
        position,
        pokemonId: state.run.offerIds[0],
      });
    state = gameReducer(state, { type: "SIMULATE" });
    for (const kind of ["points", "minutes", "award"]) {
      const copy = structuredClone(state);
      if (kind === "award") copy.run.result!.awards![0].pokemonId = 999;
      else
        copy.run.result!.games[0].boxScore![0][kind as "points" | "minutes"]++;
      const storage = storageMap();
      storage.setItem(STORAGE_KEY, JSON.stringify(copy));
      expect(loadGame(storage, 1).notice).toBeTruthy();
    }
  }, 300000); // Replays four complete 1,230-game leagues.
});

it("preserves completed v2 seasons and their awards through v3 saves", () => {
  const state = initialState(71);
  state.run.mode = "free";
  state.run.offerIds = [];
  state.run.roster = {
    PG: 65,
    SG: 135,
    SF: 6,
    PF: 68,
    C: 143,
    B1: 121,
    B2: 9,
    B3: 131,
  };
  state.run.result = v2Season(state.run);
  state.records.free = {
    runs: 1,
    bestWins: state.run.result.wins,
    perfectSeasons: Number(state.run.result.wins === 82),
  };
  const old = { ...state, version: 2 };
  const storage = storageMap();
  storage.setItem("pokemon-basketball:v2", JSON.stringify(old));
  const loaded = loadGame(storage, 99);
  expect(loaded.notice).toBeNull();
  expect(loaded.state.version).toBe(3);
  expect(loaded.state.run.result).toEqual(old.run.result);
  expect(loaded.state.run.result?.league).toBeUndefined();
  saveGame(storage, loaded.state);
  expect(loadGame(storage, 11).state).toEqual(loaded.state);
  expect(storage.getItem("pokemon-basketball:v2")).toBe(JSON.stringify(old));
});
