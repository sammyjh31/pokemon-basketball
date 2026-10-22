import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import App from "../App";
import { initialState } from "../game/state";
import { createLeague } from "../game/league";
import "../test/preloadPanels";
const storage = { getItem: () => null, setItem: () => {} };
afterEach(() => window.history.replaceState(null, "", "/"));
const navigate = (name: string) =>
  fireEvent.click(
    within(screen.getByRole("navigation", { name: "Game sections" })).getByRole(
      "button",
      { name },
    ),
  );
it("moves a pending pick between Draft and Team without showing season or roster content together", () => {
  const state = initialState(1037);
  state.run.offerIds = [25, 1, 4, 7];
  render(<App initial={state} storage={storage} />);
  expect(
    screen.queryByRole("region", { name: "Your starting lineup" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: "Simulate season" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Draft Pikachu" }));
  navigate("Team");
  expect(screen.queryByRole("button", { name: "Draft Pikachu" })).toBeNull();
  expect(
    screen.getByRole("region", { name: "Your starting lineup" }),
  ).toBeInTheDocument();
  const dock = screen.getByRole("region", { name: "Current draft pick" });
  fireEvent.change(within(dock).getByLabelText("Pick position"), {
    target: { value: "SG" },
  });
  fireEvent.click(within(dock).getByRole("button", { name: "Place at SG" }));
  expect(
    screen.getByRole("button", { name: "SG slot: Pikachu" }),
  ).toBeInTheDocument();
  navigate("Draft");
  expect(
    screen.queryByRole("region", { name: "Your starting lineup" }),
  ).toBeNull();
  expect(screen.getByText("1/8 roster spots filled")).toBeInTheDocument();
});
it("supports a season deep link and a separate postseason without resetting the completed result", () => {
  const state = initialState(22);
  state.run.roster = {
    PG: 65,
    SG: 135,
    SF: 149,
    PF: 68,
    C: 143,
    B1: 121,
    B2: 6,
    B3: 131,
  };
  const teams = createLeague(state.run);
  state.run.result = {
    modelVersion: 6,
    games: [],
    wins: 67,
    losses: 15,
    mvpId: 65,
    league: {
      teams,
      players: [],
      games: [],
      standings: teams.map((t) => ({
        teamId: t.id,
        wins: 67 - t.id,
        losses: 15 + t.id,
        pointsFor: 9000,
        pointsAgainst: 8500,
        homeWins: 35,
        awayWins: 32 - t.id,
        lastTen: 7,
        streak: 3,
      })),
      awards: [],
      allLeague: [],
      allDefense: [],
    },
  };
  window.history.replaceState(null, "", "/#season");
  render(<App initial={state} storage={storage} />);
  expect(
    screen.getByRole("heading", { name: "Season", level: 1 }),
  ).toBeInTheDocument();
  expect(screen.queryByRole("region", { name: "Playoffs" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View playoffs" }));
  expect(screen.getByRole("region", { name: "Playoffs" })).toBeInTheDocument();
  expect(
    screen.queryByRole("heading", { name: "A season to remember." }),
  ).toBeNull();
  navigate("Season");
  expect(
    screen.getByRole("heading", { name: "A season to remember." }),
  ).toBeInTheDocument();
  expect(state.run.result.wins).toBe(67);
});
