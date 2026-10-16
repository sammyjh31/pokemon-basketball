import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { MatchupLab } from "./MatchupLab";
import { ScoutReport } from "./ScoutReport";
import { GameAnalytics } from "./LeagueAnalytics";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { simulateMatch } from "../game/match";
it("explains a chosen attack type and updates resistance when the opponent changes", () => {
  render(<MatchupLab />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open matchup explorer" }),
  );
  fireEvent.change(screen.getByLabelText("Shooter"), {
    target: { value: "25" },
  });
  fireEvent.change(screen.getByLabelText("Defender"), {
    target: { value: "130" },
  });
  const matchup = screen.getByRole("region", { name: "Type matchup" });
  expect(within(matchup).getByText(/Type advantage/)).toBeInTheDocument();
  expect(matchup).toHaveTextContent(/electric/i);
  expect(
    screen.getByText("Type matchup", { selector: ".probability-factors span" }),
  ).toHaveTextContent(/\+/);
  fireEvent.change(screen.getByLabelText("Defender"), {
    target: { value: "95" },
  });
  expect(matchup).toHaveTextContent("Strong type resistance");
  expect(
    Number(
      screen
        .getByLabelText("Shot make probability")
        .textContent!.replace("%", ""),
    ),
  ).toBeGreaterThan(0);
});
it("shows dual-type scouting weaknesses and coverage", () => {
  render(<ScoutReport mon={POKEMON_BY_ID.get(6)!} />);
  const profile = screen.getByRole("region", { name: "Type scouting" });
  expect(profile).toHaveTextContent(/rock/i);
  expect(profile).toHaveTextContent(/ground/i);
  expect(within(profile).getByText("Attacking coverage")).toBeInTheDocument();
});
it("reports actual typed attacks in game analytics and omits them for historical games", () => {
  const teams = createLeague({
    ...createRun("free", false, 11),
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  });
  const match = simulateMatch(teams[0], teams[1], 91);
  const { rerender } = render(
    <GameAnalytics match={match} home={teams[0]} away={teams[1]} />,
  );
  const table = screen.getByRole("table", {
    name: "Pokémon type interactions",
  });
  expect(table).toHaveTextContent(String(match.typeMatchups!.home.advantaged));
  expect(table).toHaveTextContent("Resisted attacks");
  const counters = within(table).getByRole("row", {
    name: /Substitutions improving type coverage/,
  });
  expect(
    within(counters)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual([
    String(match.typeMatchups!.away.counterSubstitutions),
    String(match.typeMatchups!.home.counterSubstitutions),
  ]);
  expect(table).toHaveTextContent("Previous meetings scouted");
  expect(table).toHaveTextContent("Screens switched / stayed");
  expect(table).toHaveTextContent("Help rotations");
  expect(
    screen.getByRole("region", { name: "Type matchup report" }),
  ).toHaveTextContent("First meeting");
  const priorTyped = structuredClone(match);
  delete priorTyped.typeMatchups!.home.counterSubstitutions;
  delete priorTyped.typeMatchups!.away.counterSubstitutions;
  rerender(
    <GameAnalytics match={priorTyped} home={teams[0]} away={teams[1]} />,
  );
  expect(
    screen.queryByRole("row", {
      name: /Substitutions improving type coverage/,
    }),
  ).not.toBeInTheDocument();
  const old = { ...match };
  delete old.typeMatchups;
  rerender(<GameAnalytics match={old} home={teams[0]} away={teams[1]} />);
  expect(
    screen.queryByRole("table", { name: "Pokémon type interactions" }),
  ).not.toBeInTheDocument();
});
