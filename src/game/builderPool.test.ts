import { expect, it } from "vitest";
import { createRun, autoFillBench, placePokemon } from "./draft";
import { gameReducer, initialState } from "./state";
import { lineupLink, parseLineup, randomLineup } from "./lineup";
import { inDraftPool, type DraftPool } from "./draftPool";
import { loadGame, saveGame } from "./persistence";

const pools: DraftPool[] = [1, 2, 3, 4, 5, 6, 7, "all"];

it("changes a builder pool while keeping compatible players, coach, records and seeds", () => {
  const state = {
    ...initialState(41),
    run: {
      ...createRun("free", false, 41, "all"),
      coach: { version: 1 as const, id: "misty" },
    },
  };
  state.run.roster = { ...state.run.roster, PG: 25, SG: 722 };
  const changed = gameReducer(state, { type: "DRAFT_POOL", pool: 1 });
  expect(changed.run).toEqual({
    ...state.run,
    draftPool: 1,
    roster: { ...state.run.roster, SG: null },
  });
  expect(changed.records).toBe(state.records);
  const widened = gameReducer(changed, { type: "DRAFT_POOL", pool: "all" });
  expect(widened.run.roster).toEqual(changed.run.roster);
  expect(widened.run.coach).toEqual(state.run.coach);
});

it.each(pools)("builds, shares and restores a generation %s lineup", (pool) => {
  const roster = randomLineup(false, 68, pool);
  const state = { ...initialState(41), run: createRun("free", false, 41) };
  const selected = gameReducer(state, { type: "DRAFT_POOL", pool });
  const filled = gameReducer(selected, { type: "SET_LINEUP", roster });
  expect(filled.run.roster).toEqual(roster);
  expect(Object.values(roster).every((id) => inDraftPool(pool, id!))).toBe(
    true,
  );
  const bench = autoFillBench({
    ...filled.run,
    roster: { ...roster, B1: null, B2: null, B3: null },
  });
  expect(
    Object.values(bench.roster).every((id) => inDraftPool(pool, id!)),
  ).toBe(true);
  expect(new Set(Object.values(bench.roster)).size).toBe(8);
  const outside = pool === "all" ? 810 : pool === 1 ? 152 : 25;
  expect(placePokemon(selected.run, outside, "PG")).toBe(selected.run);
  const link = lineupLink(
    "https://example.com/game/?unrelated=1#season",
    roster,
    pool,
  );
  expect(new URL(link).searchParams.get("pool")).toBe(String(pool));
  expect(parseLineup(new URL(link).search)).toEqual(roster);
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  saveGame(storage, filled);
  const restored = loadGame(storage, 99);
  expect(restored.notice).toBeNull();
  expect(restored.state.run).toEqual(filled.run);
});

it("rejects mismatched or invalid pool links and preserves untagged legacy links", () => {
  expect(parseLineup("?lineup=25,26,27,28,29&pool=7")).toBeNull();
  for (const pool of ["legacy", "0", "8", "1.5", "01", "garbage", ""])
    expect(parseLineup(`?lineup=25,26,27,28,29&pool=${pool}`)).toBeNull();
  expect(parseLineup("?lineup=25,26,27,28,29")).not.toBeNull();
  expect(parseLineup("?lineup=722,723,724,725,726")).toBeNull();
  const state = initialState(4);
  expect(state.run).not.toHaveProperty("draftPool");
  expect(gameReducer(state, { type: "DRAFT_POOL", pool: 0 as DraftPool })).toBe(
    state,
  );
});
