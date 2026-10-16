import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { processCpuFreeAgency, signFreeAgent } from "../game/freeAgency";
import { rookieFixture } from "../game/rookieDraft.testUtils";
import type { GameState } from "../game/types";
import { FreeAgentMarket } from "./FreeAgentMarket";

function marketFixture(): GameState {
  const state = rookieFixture();
  const franchise = state.franchise!;
  franchise.teams[0].roster = {
    ...franchise.teams[0].roster,
    PG: 252,
    SG: 253,
  };
  franchise.rookieDrafts = [
    {
      modelVersion: 1,
      year: 1,
      generation: 3,
      order: Array.from({ length: 30 }, (_, id) => id),
      picks: [
        { pick: 1, round: 1, teamId: 0, pokemonId: 252, releasedId: 129 },
        { pick: 31, round: 2, teamId: 0, pokemonId: 253, releasedId: 25 },
      ],
      complete: true,
      tradeIndex: 0,
    },
  ];
  franchise.offseasons![0].players = [
    {
      pokemonId: 25,
      teamId: 0,
      before: 50,
      after: 55,
      minutesPerGame: 30,
      impactPer36: 10,
      changes: { passing: 12 },
      outcome: "growth",
      reasons: ["Improved passing"],
    },
  ];
  return state;
}

function setup(state = marketFixture(), disabled = false) {
  const props = { state, disabled, onSign: vi.fn(), onCpu: vi.fn() };
  return { ...render(<FreeAgentMarket {...props} />), props };
}

describe("free-agent market", () => {
  it("refreshes the market, roster choices and activity after a completed signing", () => {
    function Harness() {
      const [state, setState] = useState(marketFixture);
      return (
        <FreeAgentMarket
          state={state}
          onSign={(pokemonId, releasedId) =>
            setState((current) => signFreeAgent(current, pokemonId, releasedId))
          }
          onCpu={() => setState(processCpuFreeAgency)}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Select Pikachu" }));
    fireEvent.change(screen.getByLabelText("Player to release"), {
      target: { value: "143" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign and release" }));
    expect(
      screen.queryByRole("button", { name: "Select Pikachu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Select Snorlax" }),
    ).toBeInTheDocument();
    const release = screen.getByLabelText("Player to release");
    expect(release).toHaveTextContent("Pikachu");
    expect(release).not.toHaveTextContent("Snorlax");
    expect(within(release).getAllByRole("option")).toHaveLength(9);
    expect(release).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Sign and release" }),
    ).toBeDisabled();
    const activity = screen.getByRole("region", {
      name: "Free-agency activity",
    });
    expect(activity).toHaveTextContent("Your signing");
    expect(activity).toHaveTextContent("signs Pikachu");
    expect(activity).toHaveTextContent("Released Snorlax");
  });

  it("uses the same bench-fit comparison in the market and signing preview", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Select Pikachu" }));
    fireEvent.change(screen.getByLabelText("Player to release"), {
      target: { value: "9" },
    });
    const preview = screen.getByRole("region", { name: "Signing preview" });
    const fit = within(preview)
      .getByText(/^Roster fit/)
      .textContent!.replace("Roster fit ", "");
    const card = screen
      .getByRole("button", { name: "Select Pikachu" })
      .closest("li")!;
    expect(card).toHaveTextContent(`${fit} replacement fit · B1`);
  });

  it("requires the current completed draft and development before a signing or CPU round", () => {
    const state = marketFixture();
    state.franchise!.rookieDrafts![0].complete = false;
    const { props, rerender } = setup(state);
    expect(
      screen.getByText(/Complete this year's rookie draft/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run CPU free agency" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Select Pikachu" }));
    fireEvent.change(screen.getByLabelText("Player to release"), {
      target: { value: "143" },
    });
    expect(
      screen.getByRole("button", { name: "Sign and release" }),
    ).toBeDisabled();
    const next = structuredClone(state);
    next.franchise!.rookieDrafts![0].complete = true;
    next.franchise!.offseasons = [];
    rerender(<FreeAgentMarket {...props} state={next} />);
    expect(
      screen.getByRole("button", { name: "Run CPU free agency" }),
    ).toBeDisabled();
    expect(props.onSign).not.toHaveBeenCalled();
  });

  it("requires an explicit release and previews both players before signing", () => {
    const { props } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Select Pikachu" }));
    expect(
      screen.getByRole("button", { name: "Sign and release" }),
    ).toBeDisabled();
    const release = screen.getByLabelText("Player to release");
    expect(within(release).getAllByRole("option")).toHaveLength(9);
    fireEvent.change(release, { target: { value: "143" } });
    const preview = screen.getByRole("region", { name: "Signing preview" });
    expect(preview).toHaveTextContent("Pikachu");
    expect(preview).toHaveTextContent("Snorlax");
    expect(preview).toHaveTextContent(/eight players/i);
    expect(props.onSign).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sign and release" }));
    expect(props.onSign).toHaveBeenCalledWith(25, 143);
  });

  it("filters the market by name, number and position, and supports name sorting", () => {
    setup();
    const list = screen.getByRole("list", { name: "Available free agents" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("Sort free agents"), {
      target: { value: "name" },
    });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      "Magikarp",
    );
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search free agents" }),
      { target: { value: "pIkA" } },
    );
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list).toHaveTextContent("Pikachu");
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search free agents" }),
      { target: { value: "#129" } },
    );
    expect(list).toHaveTextContent("Magikarp");
    expect(list).not.toHaveTextContent("Pikachu");
    fireEvent.change(screen.getByLabelText("Free-agent position"), {
      target: { value: "PG" },
    });
    expect(screen.getByText(/No free agents match/)).toBeInTheDocument();
  });

  it("shows prior-club context and developed scouting for released players", () => {
    const state = marketFixture();
    setup(state);
    const list = screen.getByRole("list", { name: "Available free agents" });
    expect(list).toHaveTextContent(state.franchise!.teams[0].name);
    expect(list).toHaveTextContent(/Year 1/);
    fireEvent.click(screen.getByRole("button", { name: "Scout Pikachu" }));
    const report = screen.getByRole("region", {
      name: "Pikachu scouting report",
    });
    expect(
      within(report).getByText("Passing").closest("div"),
    ).toHaveTextContent("61"); // Base passing rounds to 49, with +12 saved development.
    fireEvent.click(
      screen.getByRole("button", { name: "View Pikachu career" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Pikachu career" }),
    ).toBeInTheDocument();
  });

  it("invalidates selected players when a roster or market changes", () => {
    const state = marketFixture();
    const { props, rerender } = setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Select Pikachu" }));
    fireEvent.change(screen.getByLabelText("Player to release"), {
      target: { value: "143" },
    });
    const changed = structuredClone(state);
    changed.franchise!.teams[0].roster.C = 254;
    rerender(<FreeAgentMarket {...props} state={changed} />);
    expect(
      screen.getByRole("button", { name: "Sign and release" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Player to release")).toHaveValue("");
    changed.franchise!.teams[1].roster.PG = 25;
    rerender(<FreeAgentMarket {...props} state={structuredClone(changed)} />);
    expect(
      screen.queryByRole("button", { name: "Select Pikachu" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sign and release" }),
    ).toBeDisabled();
  });

  it("runs CPU activity once and lets the user inspect earlier years and signing reasons", () => {
    const state = marketFixture();
    state.franchise!.year = 2;
    state.franchise!.history.push({
      ...structuredClone(state.franchise!.history[0]),
      year: 2,
    });
    state.franchise!.rookieDrafts![0].year = 2;
    state.franchise!.offseasons![0].year = 2;
    state.franchise!.freeAgency = {
      modelVersion: 1,
      cpuYears: [1],
      transactions: [
        {
          year: 1,
          teamId: 1,
          pokemonId: 25,
          releasedId: 10,
          source: "cpu",
          reason: "Adds backcourt passing.",
          tradeIndex: 0,
        },
      ],
    };
    const { props, rerender } = setup(state);
    expect(
      screen.getByText(/automatically when you start the next season/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/No signings in year 2/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Free-agency activity year"), {
      target: { value: "1" },
    });
    const activity = screen.getByRole("region", {
      name: "Free-agency activity",
    });
    expect(activity).toHaveTextContent("Pikachu");
    expect(activity).toHaveTextContent("Caterpie");
    expect(activity).toHaveTextContent("CPU");
    expect(activity).toHaveTextContent("Adds backcourt passing.");
    fireEvent.click(
      screen.getByRole("button", { name: "Run CPU free agency" }),
    );
    expect(props.onCpu).toHaveBeenCalledOnce();
    const processed = structuredClone(state);
    processed.franchise!.freeAgency!.cpuYears.push(2);
    rerender(<FreeAgentMarket {...props} state={processed} />);
    expect(
      screen.getByRole("button", { name: "CPU free agency complete" }),
    ).toBeDisabled();
  });

  it("handles an empty pool and disables mutations while the game is busy", () => {
    const state = marketFixture();
    const { props, rerender } = setup(state, true);
    expect(
      screen.getByRole("button", { name: "Select Pikachu" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Run CPU free agency" }),
    ).toBeDisabled();
    state.franchise!.rookieDrafts![0].picks = [];
    rerender(<FreeAgentMarket {...props} state={structuredClone(state)} />);
    expect(
      screen.getByText(/No released players are available/),
    ).toBeInTheDocument();
  });
});
