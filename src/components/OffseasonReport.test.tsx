import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { LeagueTeam } from "../game/types";
import { TradeActivity } from "./OffseasonReport";

const teams = [
  { id: 0, name: "Your team" },
  { id: 1, name: "Pallet Pioneers" },
] as LeagueTeam[];

describe("trade activity", () => {
  it("includes every player on both sides of a package transaction", () => {
    const trade = {
      year: 1,
      teamId: 1,
      giveId: 1,
      receiveId: 4,
      packageVersion: 1 as const,
      giveIds: [1, 2, 3],
      receiveIds: [4, 5, 6],
      reason: "The coach adds more shooting.",
    };
    render(<TradeActivity trade={trade} teams={teams} />);
    expect(screen.getByText(/Your team sends/)).toHaveTextContent(
      "Bulbasaur, Ivysaur and Venusaur",
    );
    expect(screen.getByText(/Pallet Pioneers sends/)).toHaveTextContent(
      "Charmander, Charmeleon and Charizard",
    );
  });

  it("keeps the single-player names in legacy transaction records", () => {
    render(
      <TradeActivity
        trade={{ year: 1, teamId: 1, giveId: 1, receiveId: 4 }}
        teams={teams}
      />,
    );
    expect(screen.getByText(/Your team sends/)).toHaveTextContent(
      "Bulbasaur to Pallet Pioneers",
    );
    expect(screen.getByText(/Pallet Pioneers sends/)).toHaveTextContent(
      "Charmander to Your team",
    );
  });
});
