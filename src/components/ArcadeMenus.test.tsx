import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createGame } from "../game/arcade/setup";
import { ArcadePause } from "./ArcadePause";
import { ArcadeResults } from "./ArcadeResults";
const roster = (start: number) => ({
  PG: start,
  SG: start + 1,
  SF: start + 2,
  PF: start + 3,
  C: start + 4,
  B1: start + 5,
  B2: start + 6,
  B3: start + 7,
});
const game = () =>
  createGame({
    teams: [
      { name: "Home", roster: roster(1) },
      { name: "Away", roster: roster(20) },
    ],
    seed: 42,
  });

describe("arcade match menus", () => {
  it("queues a selected active player and reserve and exposes cancellation until applied", () => {
    const state = game();
    state.paused = true;
    const queue = vi.fn(() => true),
      cancel = vi.fn(),
      resume = vi.fn();
    const props = {
      state,
      settings: { audio: false, reducedMotion: false },
      onSettings: () => {},
      onQueue: queue,
      onCancel: cancel,
      onResume: resume,
      onLeave: () => {},
    };
    const { rerender } = render(<ArcadePause {...props} />);
    const dialog = screen.getByRole("dialog", { name: "Time out" });
    expect(
      within(dialog).getByRole("button", { name: "Resume game" }),
    ).toHaveFocus();
    fireEvent.change(screen.getByLabelText("Player to rest"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Reserve to bring in"), {
      target: { value: "5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Queue swap" }));
    expect(queue).toHaveBeenCalledWith(1, 5);
    state.pendingSubs = [{ outId: 1, inId: 5 }];
    rerender(<ArcadePause {...props} state={{ ...state }} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel.*ivysaur/i }));
    expect(cancel).toHaveBeenCalledWith(1);
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(resume).toHaveBeenCalledOnce();
  });
  it("shows every player on both teams and computes totals from the displayed box scores", () => {
    const state = game();
    state.phase = "final";
    state.score = [5, 2];
    Object.assign(state.players[0].stats, {
      points: 3,
      fgm: 1,
      fga: 2,
      threePM: 1,
      threePA: 2,
      assists: 1,
      seconds: 60,
    });
    Object.assign(state.players[1].stats, {
      points: 2,
      fgm: 1,
      fga: 1,
      seconds: 60,
    });
    Object.assign(state.players[8].stats, {
      points: 2,
      fgm: 1,
      fga: 3,
      seconds: 60,
    });
    const rematch = vi.fn(),
      change = vi.fn(),
      exit = vi.fn();
    render(
      <ArcadeResults
        state={state}
        mvp={state.players[0]}
        onRematch={rematch}
        onChangeOpponent={change}
        onExit={exit}
      />,
    );
    for (const name of ["Home", "Away"]) {
      const table = screen.getByRole("table", {
        name: `${name} exhibition box score`,
      });
      expect(within(table).getAllByRole("row")).toHaveLength(10);
      const totals = within(table)
        .getByRole("rowheader", { name: "Team totals" })
        .closest("tr")!;
      expect(within(totals).getAllByRole("cell")[1]).toHaveTextContent(
        name === "Home" ? "5" : "2",
      );
    }
    expect(
      screen.getByRole("heading", { name: "Bulbasaur" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
    expect(rematch).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Change opponent" }));
    expect(change).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Back to roster" }));
    expect(exit).toHaveBeenCalledOnce();
  });
});
