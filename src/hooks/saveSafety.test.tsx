import { act, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { gameReducer, initialState } from "../game/state";
import { STORAGE_KEY } from "../game/persistence";
import {
  backupKey,
  quarantineKey,
  SaveStorage,
  type LocalArea,
} from "../game/saveStorage";
import { LOCAL_LEAGUE_KEY } from "../game/localLeague";
import { ROSTER_SLOTS } from "../game/types";
import { useGame } from "./useGame";
import { useLocalLeague } from "./useLocalLeague";
import App from "../App";
import { coachOffers } from "../game/trainerCoaches";

function slots(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  const area: LocalArea = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
  return { data, storage: new SaveStorage(() => area) };
}
const drafted = () => {
  let state = initialState(5);
  for (const position of ROSTER_SLOTS.slice(0, 3))
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  return state;
};
const otherTabWrites = (key: string) =>
  act(() => {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key,
        newValue: "changed elsewhere",
        storageArea: window.localStorage,
      }),
    );
  });

describe("solo and franchise save safety", () => {
  it("keeps a verified save as the backup", () => {
    const source = JSON.stringify(drafted());
    const { data, storage } = slots({ [STORAGE_KEY]: source });
    const { result } = renderHook(() => useGame(undefined, storage));
    expect(result.current.storageNotice).toBeNull();
    expect(data.get(backupKey(STORAGE_KEY))).toBe(source);
    // Not rewritten unchanged, which would pause other open tabs.
    expect(data.get(STORAGE_KEY)).toBe(source);
  });

  it("sets a rejected save aside before any later save replaces it", () => {
    const { data, storage } = slots({ [STORAGE_KEY]: "{malformed" });
    const { result } = renderHook(() => useGame(undefined, storage));
    expect(result.current.storageNotice).toMatch(/set aside in Save options/);
    expect(data.get(quarantineKey(STORAGE_KEY))).toBe("{malformed");
    expect(data.get(STORAGE_KEY)).toBe("{malformed");
    act(() => result.current.dispatch({ type: "REROLL" }));
    expect(data.get(STORAGE_KEY)).not.toBe("{malformed");
    expect(data.get(quarantineKey(STORAGE_KEY))).toBe("{malformed");
    expect(data.has(backupKey(STORAGE_KEY))).toBe(false);
  });

  it("offers the last verified backup after a save fails to load", () => {
    const backup = JSON.stringify(drafted());
    const { storage } = slots({
      [STORAGE_KEY]: "{malformed",
      [backupKey(STORAGE_KEY)]: backup,
    });
    render(<App storage={storage} />);
    expect(
      screen.getByRole("button", { name: "Restore last verified backup" }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Download set-aside save" }),
    ).toBeVisible();
  });

  it("stops saving after another tab writes the same save", () => {
    const source = JSON.stringify(drafted());
    const { data, storage } = slots({ [STORAGE_KEY]: source });
    const { result } = renderHook(() => useGame(undefined, storage));
    otherTabWrites("pokemon-basketball:local-league:v1");
    expect(result.current.saveControls.otherTab).toBe(false);
    otherTabWrites(STORAGE_KEY);
    expect(result.current.saveControls.otherTab).toBe(true);
    data.set(STORAGE_KEY, "newer progress from the other tab");
    act(() => result.current.dispatch({ type: "REROLL" }));
    expect(data.get(STORAGE_KEY)).toBe("newer progress from the other tab");
    expect(result.current.retrySave).toBeUndefined();
  });

  it("imports only a fully verified save and then backs it up", async () => {
    const { data, storage } = slots();
    const { result } = renderHook(() => useGame(undefined, storage));
    const signal = new AbortController().signal;
    await expect(
      result.current.saveControls.checkImport(
        '{"version":3}',
        () => {},
        signal,
      ),
    ).rejects.toThrow(/could not be fully verified/);
    const imported = drafted();
    const source = JSON.stringify(imported);
    const checked = await result.current.saveControls.checkImport(
      source,
      () => {},
      signal,
    );
    expect(checked.summary).toMatch(/draft/);
    expect(data.get(STORAGE_KEY)).not.toBe(source);
    act(() => checked.apply());
    expect(result.current.state).toEqual(imported);
    expect(JSON.parse(data.get(STORAGE_KEY)!)).toEqual(imported);
    expect(data.get(backupKey(STORAGE_KEY))).toBe(source);
    expect(JSON.parse(result.current.saveControls.exportSave()!)).toEqual(
      imported,
    );
  });
});

describe("trainer coach saves", () => {
  it("backs up, exports and imports a save with a trainer coach", async () => {
    const start = drafted();
    const coached = gameReducer(start, {
      type: "SELECT_COACH",
      id: coachOffers(start.run.seasonSeed)[0].id,
    });
    expect(coached.run.coach).toBeDefined();
    const source = JSON.stringify(coached);
    const { data, storage } = slots({ [STORAGE_KEY]: source });
    const { result } = renderHook(() => useGame(undefined, storage));
    expect(result.current.storageNotice).toBeNull();
    expect(result.current.state.run.coach).toEqual(coached.run.coach);
    expect(data.get(backupKey(STORAGE_KEY))).toBe(source);
    const exported = result.current.saveControls.exportSave()!;
    expect(JSON.parse(exported).run.coach).toEqual(coached.run.coach);
    const fresh = slots();
    const other = renderHook(() => useGame(undefined, fresh.storage));
    const checked = await other.result.current.saveControls.checkImport(
      exported,
      () => {},
      new AbortController().signal,
    );
    act(() => checked.apply());
    expect(other.result.current.state.run.coach).toEqual(coached.run.coach);
  });
});

describe("local league save safety", () => {
  it("sets a damaged local league aside and imports a valid one", async () => {
    const { data, storage } = slots({ [LOCAL_LEAGUE_KEY]: "[1,2]" });
    const { result } = renderHook(() => useLocalLeague(storage));
    expect(result.current.notice).toMatch(/set aside/);
    expect(data.get(quarantineKey(LOCAL_LEAGUE_KEY))).toBe("[1,2]");
    const signal = new AbortController().signal;
    await expect(
      result.current.saveControls.checkImport("{}", () => {}, signal),
    ).rejects.toThrow();
    // A league save just after setup is a valid, unfinished draft.
    const { createLocalLeague } = await import("../game/localLeague");
    const managers = [
      { name: "Sam", teamId: 0 },
      { name: "Alex", teamId: 1 },
    ];
    const source = JSON.stringify(createLocalLeague(managers, false, 9, 2));
    const checked = await result.current.saveControls.checkImport(
      source,
      () => {},
      signal,
    );
    act(() => checked.apply());
    expect(result.current.draft?.managers).toEqual(managers);
    expect(data.get(backupKey(LOCAL_LEAGUE_KEY))).toBe(source);
    expect(data.get(quarantineKey(LOCAL_LEAGUE_KEY))).toBe("[1,2]");
  });

  it("backs up a loaded league without rewriting it", async () => {
    const { createLocalLeague } = await import("../game/localLeague");
    const league = createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Alex", teamId: 1 },
      ],
      false,
      3,
      2,
    );
    // Stored with a different key order than the parser produces.
    const source = JSON.stringify(
      Object.fromEntries(Object.entries(league).reverse()),
    );
    const { data, storage } = slots({ [LOCAL_LEAGUE_KEY]: source });
    const { result } = renderHook(() => useLocalLeague(storage));
    expect(result.current.draft?.seed).toBe(3);
    expect(data.get(LOCAL_LEAGUE_KEY)).toBe(source);
    expect(data.get(backupKey(LOCAL_LEAGUE_KEY))).toBe(source);
  });

  it("pauses local league saving after another tab writes it", () => {
    const { data, storage } = slots();
    const { result } = renderHook(() => useLocalLeague(storage));
    otherTabWrites(LOCAL_LEAGUE_KEY);
    act(() => result.current.reset());
    expect(data.has(LOCAL_LEAGUE_KEY)).toBe(false);
    expect(result.current.saveControls.otherTab).toBe(true);
  });
});
