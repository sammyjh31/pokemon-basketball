import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Franchise } from "../game/franchiseTypes";
import { ROSTER_SLOTS, type LeagueTeam } from "../game/types";
import { TradeCenter } from "./TradeCenter";

function fixture(): Franchise {
  return {
    modelVersion: 1,
    year: 1,
    phase: "offseason",
    careers: [],
    history: [],
    trades: [],
    teams: Array.from({ length: 30 }, (_, id) => ({
      id,
      name:
        id === 0
          ? "Your team"
          : id === 1
            ? "Pallet Pioneers"
            : `Club ${id + 1}`,
      roster: Object.fromEntries(
        ROSTER_SLOTS.map((slot, index) => [slot, id * 8 + index + 1]),
      ) as LeagueTeam["roster"],
      tactic: "balanced",
      defense: "man",
      rotation: "balanced",
      ratings: {
        offense: 60,
        defense: 60,
        overall: 60,
        filled: 5,
        complete: true,
      },
    })),
  };
}

describe("trade center", () => {
  it("searches the whole market by Pokémon or club and combines market filters", () => {
    render(<TradeCenter franchise={fixture()} onTrade={vi.fn()} />);
    const market = screen.getByRole("list", { name: "Trade market players" });
    expect(screen.getByText("232 players match")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search trade market"), {
      target: { value: "Blastoise" },
    });
    expect(within(market).getAllByRole("listitem")).toHaveLength(1);
    expect(
      within(market).getByRole("button", { name: "Target Blastoise" }),
    ).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Search trade market"), {
      target: { value: "Pallet" },
    });
    expect(within(market).getAllByRole("listitem")).toHaveLength(8);
    fireEvent.change(screen.getByLabelText("Filter market by team"), {
      target: { value: "2" },
    });
    expect(
      screen.getByText(/No players match these filters/),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Reset market filters" }),
    );
    expect(screen.getByText("232 players match")).toBeInTheDocument();
  });

  it("selects a target's club and builds equal packages with a three-player cap", () => {
    render(<TradeCenter franchise={fixture()} onTrade={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Target Blastoise" }));
    expect(screen.getByLabelText("Trade partner")).toHaveValue("1");
    expect(screen.getByLabelText("Receive Blastoise")).toBeChecked();
    for (const name of ["Bulbasaur", "Ivysaur", "Venusaur"])
      fireEvent.click(screen.getByLabelText(`Send ${name}`));
    expect(screen.getByLabelText("Send Charmander")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Complete trade" }),
    ).toBeDisabled();
    expect(screen.getByText(/3 sent · 1 received/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Receive Caterpie"));
    fireEvent.click(screen.getByLabelText("Receive Metapod"));
    expect(screen.getByLabelText("Receive Butterfree")).toBeDisabled();
    expect(screen.getByText(/3 sent · 3 received/)).toBeInTheDocument();
    expect(
      screen.getByText(/Both clubs keep eight players/),
    ).toBeInTheDocument();
  });

  it("resets incoming players when changing partner and removes stale owned selections", () => {
    const franchise = fixture();
    const { rerender } = render(
      <TradeCenter franchise={franchise} onTrade={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Target Blastoise" }));
    fireEvent.click(screen.getByLabelText("Send Bulbasaur"));
    fireEvent.change(screen.getByLabelText("Trade partner"), {
      target: { value: "2" },
    });
    expect(
      screen.queryByLabelText("Receive Blastoise"),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/1 sent · 0 received/)).toBeInTheDocument();
    const updated = structuredClone(franchise);
    updated.teams[0].roster.PG = 9;
    updated.teams[1].roster.PG = 1;
    rerender(<TradeCenter franchise={updated} onTrade={vi.fn()} />);
    expect(screen.queryByLabelText("Send Bulbasaur")).not.toBeInTheDocument();
    expect(screen.getByText(/0 sent · 0 received/)).toBeInTheDocument();
    expect(screen.getByText(/Roster changed/)).toBeInTheDocument();
  });

  it("keeps all trade actions disabled while the parent is busy", () => {
    render(<TradeCenter franchise={fixture()} disabled onTrade={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Target Blastoise" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Send Bulbasaur")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Find deals" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Complete trade" }),
    ).toBeDisabled();
  });

  it("filters positions and availability across the whole market", () => {
    render(<TradeCenter franchise={fixture()} onTrade={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Filter market by position"), {
      target: { value: "PG" },
    });
    fireEvent.change(screen.getByLabelText("Filter market by availability"), {
      target: { value: "available" },
    });
    const players = within(
      screen.getByRole("list", { name: "Trade market players" }),
    ).getAllByRole("listitem");
    expect(players.length).toBeGreaterThan(0);
    expect(players.length).toBeLessThan(232);
    for (const player of players) {
      expect(within(player).getByText(/^PG ·/)).toBeInTheDocument();
      expect(within(player).getByText("Available")).toBeInTheDocument();
    }
  });

  it("explains the rookie draft lock and restores trading after completion", () => {
    const franchise = fixture();
    franchise.rookieDrafts = [
      {
        modelVersion: 1,
        year: 1,
        generation: 3,
        order: Array.from({ length: 30 }, (_, id) => id),
        picks: [],
        complete: false,
        tradeIndex: 0,
      },
    ];
    const { rerender } = render(
      <TradeCenter franchise={franchise} onTrade={vi.fn()} />,
    );
    expect(
      screen.getByText("Complete the current rookie draft before trading."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Target Caterpie" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Send Bulbasaur")).toBeDisabled();
    const completed = structuredClone(franchise);
    completed.rookieDrafts![0].complete = true;
    rerender(<TradeCenter franchise={completed} onTrade={vi.fn()} />);
    expect(
      screen.queryByText("Complete the current rookie draft before trading."),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Target Caterpie" }),
    ).toBeEnabled();
  });

  it("explains a declined offer before any transaction can be submitted", () => {
    const onTrade = vi.fn();
    render(<TradeCenter franchise={fixture()} onTrade={onTrade} />);
    fireEvent.click(screen.getByRole("button", { name: "Target Blastoise" }));
    fireEvent.click(screen.getByLabelText("Send Bulbasaur"));
    expect(screen.getByText("Coach declines this offer")).toBeInTheDocument();
    const verdict = screen.getByRole("region", { name: "Coach evaluation" });
    expect(
      within(verdict).getByText(/Why this coach says no/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete trade" }),
    ).toBeDisabled();
    expect(onTrade).not.toHaveBeenCalled();
  });

  it("finds an accepted target offer and loads it for review before executing once", async () => {
    const onTrade = vi.fn();
    render(<TradeCenter franchise={fixture()} onTrade={onTrade} />);
    fireEvent.click(screen.getByRole("button", { name: "Target Caterpie" }));
    fireEvent.click(screen.getByRole("button", { name: "Find deals" }));
    const review = await screen.findAllByRole("button", {
      name: /Review offer/,
    });
    expect(onTrade).not.toHaveBeenCalled();
    fireEvent.click(review[0]);
    expect(screen.getByLabelText("Receive Caterpie")).toBeChecked();
    expect(screen.getByText("Coach accepts this offer")).toBeInTheDocument();
    const complete = screen.getByRole("button", { name: "Complete trade" });
    fireEvent.click(complete);
    fireEvent.click(complete);
    expect(onTrade).toHaveBeenCalledOnce();
    expect(onTrade.mock.calls[0][0]).toMatchObject({
      teamId: 1,
      receiveIds: [10],
    });
  });

  it("uses the selected outgoing package and requested size for deal suggestions", async () => {
    render(<TradeCenter franchise={fixture()} onTrade={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Send Venusaur"));
    fireEvent.click(screen.getByLabelText("Send Charizard"));
    fireEvent.change(screen.getByLabelText("Suggestion package size"), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find deals" }));
    const review = await screen.findAllByRole("button", {
      name: /Review offer/,
    });
    fireEvent.click(review[0]);
    expect(screen.getByLabelText("Send Venusaur")).toBeChecked();
    expect(screen.getByLabelText("Send Charizard")).toBeChecked();
    expect(
      within(
        screen.getByRole("list", { name: "Receive players" }),
      ).getAllByRole("checkbox", { checked: true }),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Complete trade" }),
    ).toBeEnabled();
  });

  it("requires a fixed outgoing package to match the requested suggestion size", () => {
    render(<TradeCenter franchise={fixture()} onTrade={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Send Bulbasaur"));
    fireEvent.change(screen.getByLabelText("Suggestion package size"), {
      target: { value: "3" },
    });
    expect(screen.getByRole("button", { name: "Find deals" })).toBeDisabled();
    expect(
      screen.getByText(/Select exactly 3 players to send/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No accepted offers found/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Review offer/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Complete trade" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Suggestion package size"), {
      target: { value: "auto" },
    });
    expect(screen.getByRole("button", { name: "Find deals" })).toBeEnabled();
    expect(
      screen.queryByText(/Select exactly 3 players to send/),
    ).not.toBeInTheDocument();
  });
});
