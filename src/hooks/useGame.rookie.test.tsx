import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useGame } from "./useGame";
import { rookieFixture } from "../game/rookieDraft.testUtils";
import { beginRookieDraft } from "../game/rookieDraft";
import { runRookieDraftJob } from "../game/rookieDraftClient";
vi.mock("../game/rookieDraftClient", () => ({ runRookieDraftJob: vi.fn() }));
afterEach(() => vi.resetAllMocks());

it("keeps the current franchise and stored save until the background rookie draft finishes", async () => {
  const initial = rookieFixture();
  let finish!: (value: typeof initial) => void;
  vi.mocked(runRookieDraftJob).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const storage = { getItem: () => null, setItem: vi.fn() };
  const { result } = renderHook(() => useGame(initial, storage));
  const writes = storage.setItem.mock.calls.length;
  act(() => result.current.dispatch({ type: "BEGIN_ROOKIE_DRAFT" }));
  expect(result.current.rookieDraftBusy).toBe(true);
  expect(result.current.state).toBe(initial);
  expect(storage.setItem).toHaveBeenCalledTimes(writes);
  act(() =>
    result.current.dispatch({
      type: "NEW_RUN",
      mode: "free",
      includeLegends: true,
      seed: 42,
    }),
  );
  expect(result.current.state).toBe(initial);
  await act(async () => finish(beginRookieDraft(initial)));
  await waitFor(() => expect(result.current.rookieDraftBusy).toBe(false));
  expect(result.current.state.franchise!.rookieDrafts).toHaveLength(1);
});

it("ignores a canceled rookie result and preserves the original franchise", async () => {
  const initial = rookieFixture();
  let finish!: (value: typeof initial) => void;
  vi.mocked(runRookieDraftJob).mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const { result } = renderHook(() =>
    useGame(initial, { getItem: () => null, setItem: () => {} }),
  );
  act(() => result.current.dispatch({ type: "BEGIN_ROOKIE_DRAFT" }));
  act(() => result.current.cancelRookieDraft());
  await act(async () => finish(beginRookieDraft(initial)));
  expect(result.current.state).toBe(initial);
  expect(result.current.rookieDraftBusy).toBe(false);
});

it("unlocks the unchanged franchise after a background draft failure so the user can retry", async () => {
  const initial = rookieFixture();
  vi.mocked(runRookieDraftJob).mockRejectedValue(new Error("Worker stopped"));
  const { result } = renderHook(() =>
    useGame(initial, { getItem: () => null, setItem: () => {} }),
  );
  await act(async () =>
    result.current.dispatch({ type: "BEGIN_ROOKIE_DRAFT" }),
  );
  expect(result.current.rookieDraftBusy).toBe(false);
  expect(result.current.state).toBe(initial);
  expect(result.current.rookieDraftError).toContain(
    "Your progress is unchanged",
  );
  act(() =>
    result.current.dispatch({
      type: "NEW_RUN",
      mode: "free",
      includeLegends: true,
      seed: 42,
    }),
  );
  expect(result.current.state.franchise).toBeUndefined();
});
