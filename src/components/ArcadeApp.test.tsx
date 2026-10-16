import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../App";
import { initialState } from "../game/state";
import { simulateSeason } from "../game/legacySeason";
describe("arcade entry", () => {
  it("requires a complete eight-player roster", () => {
    render(
      <App
        initial={initialState(42)}
        storage={{ getItem: () => null, setItem: () => {} }}
      />,
    );
    expect(screen.getByRole("button", { name: "Play arcade" })).toBeDisabled();
  });
  it("opens an exhibition and returns without changing a saved season", async () => {
    const state = initialState(42);
    state.run.roster = {
      PG: 65,
      SG: 135,
      SF: 6,
      PF: 68,
      C: 143,
      B1: 25,
      B2: 9,
      B3: 3,
    };
    state.run.result = { ...simulateSeason(state.run), modelVersion: 1 };
    const before = JSON.stringify(state);
    let saved = "";
    render(
      <App
        initial={state}
        storage={{
          getItem: () => null,
          setItem: (_k, v) => {
            saved = v;
          },
        }}
      />,
    );
    const originalSave = saved;
    fireEvent.click(screen.getByRole("button", { name: "Play arcade" }));
    await screen.findByRole("button", { name: /Tip off/i });
    fireEvent.click(screen.getByRole("button", { name: /Back to roster/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Play arcade" }),
      ).toBeInTheDocument(),
    );
    expect(JSON.stringify(state)).toBe(before);
    expect(saved).toBe(originalSave);
  });
});
