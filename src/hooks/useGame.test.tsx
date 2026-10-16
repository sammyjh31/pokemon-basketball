import { renderHook } from "@testing-library/react";
import { expect, it } from "vitest";
import { initialState } from "../game/state";
import { STORAGE_KEY, type StorageLike } from "../game/persistence";
import { useGame } from "./useGame";

it("does not rewrite an unchanged mounted game over newer progress on effect refresh", () => {
  let value: string | null = null;
  const adapter = (): StorageLike => ({
    getItem: () => value,
    setItem: (_key, next) => {
      value = next;
    },
  });
  const stale = initialState(11);
  const active = initialState(22);
  const mounted = renderHook(({ storage }) => useGame(stale, storage), {
    initialProps: { storage: adapter() },
  });
  renderHook(() => useGame(active, adapter()));
  const latest = value;
  // Fast Refresh recreates module-level storage adapters and reruns effects.
  mounted.rerender({ storage: adapter() });
  expect(adapter().getItem(STORAGE_KEY)).toBe(latest);
});
