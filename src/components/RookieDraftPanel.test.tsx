import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  beginRookieDraft,
  advanceRookieDraft,
  selectRookie,
} from "../game/rookieDraft";
import { rookieFixture } from "../game/rookieDraft.testUtils";
import { ROOKIE_POKEMON } from "../data/pokemon";
import type { GameState } from "../game/types";
import { RookieDraftPanel } from "./RookieDraftPanel";

function Harness({
  initial = rookieFixture(),
  disabled = false,
}: {
  initial?: GameState;
  disabled?: boolean;
}) {
  const [state, setState] = useState(initial);
  return (
    <RookieDraftPanel
      state={state}
      disabled={disabled}
      onBegin={() => setState(beginRookieDraft)}
      onAdvance={() => setState(advanceRookieDraft)}
      onPick={(pokemonId, releasedId) =>
        setState((current) => selectRookie(current, pokemonId, releasedId))
      }
    />
  );
}

describe("rookie draft panel", () => {
  it("explains the class and two-round replacement rules, and waits for development", () => {
    const state = rookieFixture();
    state.franchise!.offseasons = [];
    render(<Harness initial={state} />);
    expect(
      screen.getByRole("heading", { name: /Rookie draft/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Generation III/)).toBeInTheDocument();
    expect(screen.getByText(/two rounds/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Begin rookie draft" }),
    ).toBeDisabled();
    expect(screen.getByText(/Process player development/i)).toBeInTheDocument();
  });

  it("searches, scouts, replaces a selected player, and advances to the second user pick", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Begin rookie draft" }));
    expect(screen.getByText(/Round 1 · Pick 1 of 60/)).toBeInTheDocument();
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search rookie prospects" }),
      { target: { value: "Treecko" } },
    );
    fireEvent.click(screen.getByRole("button", { name: /Scout Treecko/ }));
    expect(
      screen.getByRole("region", { name: "Treecko scouting report" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Draft Treecko" }),
    ).toBeDisabled();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Player to release" }),
      { target: { value: "129" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft Treecko" }));
    expect(screen.getByText(/Round 2 · Pick 31 of 60/)).toBeInTheDocument();
    expect(screen.getByText("30 of 60 picks made")).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Rookie draft board" }),
    ).toHaveTextContent("Treecko");
    expect(
      screen.getByRole("table", { name: "Rookie draft board" }),
    ).toHaveTextContent("Magikarp");
    expect(
      screen.getByRole("combobox", { name: "Player to release" }),
    ).not.toHaveTextContent("Magikarp");
  });

  it("lets the user draft each shown recommendation and review all sixty picks", () => {
    render(<Harness initial={beginRookieDraft(rookieFixture())} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Draft recommended pick" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Draft recommended pick" }),
    );
    expect(screen.getByText("Draft complete")).toBeInTheDocument();
    expect(screen.getByText("60 of 60 picks made")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draft recommended pick" }),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getByRole("table", { name: "Rookie draft board" })
        .querySelectorAll("tbody tr"),
    ).toHaveLength(60);
  });

  it("shows why remaining picks were skipped when the class is exhausted", () => {
    const state = rookieFixture();
    state.franchise!.history[0].rosters.push(
      ROOKIE_POKEMON.filter((mon) => mon.generation === 3).map((mon) => mon.id),
    );
    render(<Harness initial={beginRookieDraft(state)} />);
    expect(screen.getByText(/No eligible rookies remain/)).toBeInTheDocument();
    expect(screen.getByText(/60 remaining picks skipped/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Draft recommended pick" }),
    ).not.toBeInTheDocument();
  });
});
