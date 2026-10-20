import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeagueFriendCards, DraftRosterBoard } from "./LeagueVisuals";
import { emptyRoster } from "../game/types";
import { createLocalLeague, localLeagueTeams } from "../game/localLeague";

describe("visual league summaries", () => {
  it("shows the saved team's players in their real positions and marks locks", () => {
    render(
      <DraftRosterBoard
        roster={{ ...emptyRoster(), PG: 65, C: 95, B1: 25 }}
        lockedSlots={["C"]}
      />,
    );
    const five = screen.getByRole("list", { name: "Your starting five" });
    const slots = within(five).getAllByRole("listitem");
    expect(slots).toHaveLength(5);
    expect(slots[0]).toHaveTextContent("PG");
    expect(
      within(slots[0]).getByRole("img", { name: "Alakazam" }),
    ).toBeInTheDocument();
    expect(slots[4]).toHaveTextContent("C");
    expect(slots[4]).toHaveTextContent("Locked");
    expect(
      within(slots[4]).getByRole("img", { name: "Onix" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Your reserves" })).getByRole(
        "img",
        { name: "Pikachu" },
      ),
    ).toBeInTheDocument();
    expect(within(five).getAllByText("Open")).toHaveLength(3);
  });

  it("uses season wins and losses for the visual win rate", () => {
    const teams = localLeagueTeams(
      createLocalLeague(
        [
          { name: "Sam", teamId: 0 },
          { name: "Alex", teamId: 1 },
        ],
        false,
        42,
      ),
    );
    teams[0].roster = { ...emptyRoster(), PG: 65, SG: 25, C: 95 };
    render(
      <LeagueFriendCards
        teams={teams}
        rankings={[
          {
            manager: { name: "Sam", teamId: 0 },
            leagueRank: 3,
            standing: {
              teamId: 0,
              wins: 51,
              losses: 31,
              pointsFor: 10000,
              pointsAgainst: 9500,
              homeWins: 25,
              awayWins: 26,
              lastTen: 0,
              streak: 0,
            },
          },
        ]}
      />,
    );
    const card = screen.getByRole("article", { name: "Sam season summary" });
    expect(card).toHaveTextContent("51");
    expect(card).toHaveTextContent("31");
    expect(card).toHaveTextContent("62.2%");
    expect(card).toHaveTextContent("#3 in league");
    expect(
      within(card).getByRole("meter", { name: "Sam win rate" }),
    ).toHaveAttribute("value", "51");
    expect(
      within(card).getByRole("meter", { name: "Sam win rate" }),
    ).toHaveAttribute("max", "82");
    expect(
      within(card).getByRole("img", { name: "Alakazam" }),
    ).toBeInTheDocument();
  });
});
