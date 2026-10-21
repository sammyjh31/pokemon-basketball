import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "../App";
import { gameReducer, initialState } from "../game/state";
import { STORAGE_KEY } from "../game/persistence";
import { LOCAL_LEAGUE_KEY } from "../game/localLeague";
import { Scoreboard } from "./Scoreboard";
import "../test/preloadPanels";

it.each(["free", "spin"] as const)(
  "restarts %s from the masthead only after confirmation and preserves the local save",
  (mode) => {
    let state = gameReducer(initialState(17), {
      type: "NEW_RUN",
      mode,
      includeLegends: true,
      seed: 17,
    });
    state = gameReducer(state, {
      type: "PLACE",
      position: "PG",
      pokemonId: mode === "free" ? 25 : state.run.offerIds[0],
    });
    const data = new Map([[LOCAL_LEAGUE_KEY, "separate local league"]]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    render(<App initial={state} storage={storage} />);
    const restart = within(screen.getByRole("banner")).getByRole("button", {
      name: "New game / Restart",
    });
    const original = storage.getItem(STORAGE_KEY);
    fireEvent.click(restart);
    expect(
      screen.getByRole("dialog", { name: "Start a new run?" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep playing" }));
    expect(storage.getItem(STORAGE_KEY)).toBe(original);
    fireEvent.click(restart);
    fireEvent.click(screen.getByRole("button", { name: "Start new run" }));
    const saved = JSON.parse(storage.getItem(STORAGE_KEY)!);
    expect(Object.values(saved.run.roster)).toEqual(Array(8).fill(null));
    expect(saved.run.mode).toBe(mode);
    expect(saved.records).toEqual(state.records);
    expect(storage.getItem(LOCAL_LEAGUE_KEY)).toBe("separate local league");
  },
);

it("disables the masthead restart while work is running", () => {
  render(
    <Scoreboard mode="spin" onMode={() => {}} onRestart={() => {}} disabled />,
  );
  expect(
    screen.getByRole("button", { name: "New game / Restart" }),
  ).toBeDisabled();
});
