import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LeagueNewsPanel } from "./LeagueNewsPanel";
import { buildLeagueNews } from "../game/leagueNews";
const stories = buildLeagueNews([
  { year: 1, teams: [{ id: 0, name: "Kanto" }], championId: 0 },
  {
    year: 2,
    teams: [
      { id: 0, name: "Kanto" },
      { id: 1, name: "Johto" },
    ],
    championId: 1,
    picks: [{ pick: 1, teamId: 0, pokemonId: 25, releasedId: 6 }],
  },
]);
describe("LeagueNewsPanel", () => {
  it("starts leaguewide and filters year, human team and category with accessible controls", async () => {
    const user = userEvent.setup();
    render(<LeagueNewsPanel stories={stories} yourTeamIds={[0]} />);
    expect(screen.getByText("Johto win the championship")).toBeInTheDocument();
    expect(
      screen.queryByText("Kanto win the championship"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Your teams only"));
    expect(
      screen.queryByText("Johto win the championship"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Kanto draft Pikachu")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("News category"), "honors");
    expect(
      screen.getByText("No recorded stories match these filters."),
    ).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("News season"), "1");
    expect(screen.getByText("Kanto win the championship")).toBeInTheDocument();
  });
  it("opens source details and uses callbacks only for available game/player views", async () => {
    const user = userEvent.setup(),
      onPlayer = vi.fn();
    render(<LeagueNewsPanel stories={stories} onPlayer={onPlayer} />);
    await user.click(screen.getByRole("button", { name: "View Pikachu" }));
    expect(onPlayer).toHaveBeenCalledWith(25, 2);
    expect(
      screen.queryByRole("button", { name: "Open game" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Year 2 · Saved rookie draft")).toBeInTheDocument();
  });
});
