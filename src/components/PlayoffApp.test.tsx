import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import App from "../App";
import { gameReducer, initialState } from "../game/state";
import { ROSTER_SLOTS, type GameState } from "../game/types";
import { STORAGE_KEY, type StorageLike } from "../game/persistence";

const memory = (value: string | null = null): StorageLike => ({
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
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("saves one complete playoff slate, blocks duplicate work and resets, then resumes the same bracket after refresh", async () => {
  vi.useFakeTimers();
  const storage = memory();
  const mounted = render(<App initial={finished} storage={storage} />);
  const playoffs = within(screen.getByRole("region", { name: "Playoffs" }));
  const advance = playoffs.getByRole("button", { name: "Play next slate" });
  fireEvent.click(advance);
  fireEvent.click(advance);
  expect(advance).toBeDisabled();
  expect(screen.getByRole("button", { name: "New run" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Lineup builder" })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Play arcade" })).toBeDisabled();
  expect(
    JSON.parse(storage.getItem(STORAGE_KEY)!).run.playoffs,
  ).toBeUndefined();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(
    saved.run.playoffs!.series.reduce(
      (count, series) => count + series.games.length,
      0,
    ),
  ).toBe(8);
  expect(saved.run.result).toEqual(finished.run.result);
  expect(saved.records).toEqual(finished.records);
  expect(advance).toBeEnabled();
  expect(screen.getByRole("button", { name: "Play arcade" })).toBeEnabled();
  mounted.unmount();

  render(
    <StrictMode>
      <App storage={storage} />
    </StrictMode>,
  );
  expect(
    screen.getByRole("heading", { name: "Restoring your league" }),
  ).toBeInTheDocument();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(saved);
  expect(screen.getByRole("region", { name: "Playoffs" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play next slate" }));
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  const resumed = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(
    resumed.run.playoffs!.series.reduce(
      (count, series) => count + series.games.length,
      0,
    ),
  ).toBe(16);
  expect(resumed.records).toEqual(finished.records);
}, 60000);

it("keeps damaged playoff save bytes through recovery and replaces them only after a new playoff action completes", async () => {
  vi.useFakeTimers();
  const source = JSON.stringify(
    { ...finished, run: { ...finished.run, playoffs: { modelVersion: 99 } } },
    null,
    2,
  );
  const storage = memory(source);
  render(<App storage={storage} />);
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(
    screen.getByText(/saved playoffs could not be restored/i),
  ).toBeInTheDocument();
  expect(screen.getByTestId("season-record")).toHaveTextContent(
    `${finished.run.result!.wins}–${finished.run.result!.losses}`,
  );
  expect(storage.getItem(STORAGE_KEY)).toBe(source);
  fireEvent.click(screen.getByRole("button", { name: "Play next slate" }));
  expect(storage.getItem(STORAGE_KEY)).toBe(source);
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  const saved = JSON.parse(storage.getItem(STORAGE_KEY)!) as GameState;
  expect(
    saved.run.playoffs!.series.reduce(
      (count, series) => count + series.games.length,
      0,
    ),
  ).toBe(8);
  expect(saved.records).toEqual(finished.records);
  expect(
    screen.queryByText(/saved playoffs could not be restored/i),
  ).not.toBeInTheDocument();
}, 60000);

it("cancels unfinished postseason work on unmount without saving a partial action", async () => {
  vi.useFakeTimers();
  const storage = memory();
  const mounted = render(<App initial={finished} storage={storage} />);
  const source = storage.getItem(STORAGE_KEY);
  fireEvent.click(screen.getByRole("button", { name: "Finish playoffs" }));
  mounted.unmount();
  await act(async () => {
    await vi.runAllTimersAsync();
  });
  expect(storage.getItem(STORAGE_KEY)).toBe(source);
});
