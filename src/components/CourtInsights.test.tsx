import { render, screen, fireEvent, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { CourtInsights } from "./CourtInsights";
import { simulateMatch } from "../game/match";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
it("shows both teams coverage counts and browsable real possession positions", () => {
  const teams = createLeague({
    ...createRun("free", true, 22),
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
  const match = simulateMatch(teams[0], teams[1], 7);
  const { rerender } = render(
    <CourtInsights
      sequences={match.insights!.court}
      teams={teams.slice(0, 2)}
    />,
  );
  expect(
    screen.getByRole("table", { name: "Screen coverage results" }),
  ).toHaveTextContent(teams[0].name);
  expect(
    screen.getByRole("img", { name: /simulated court positions/i }),
  ).toBeInTheDocument();
  expect(
    within(screen.getByRole("list", { name: "Players on court" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(10);
  const before = screen.getByRole("list", {
    name: "Possession actions",
  }).textContent;
  fireEvent.click(screen.getByRole("button", { name: "Next attack" }));
  expect(
    screen.getByRole("list", { name: "Possession actions" }).textContent,
  ).not.toBe(before);
  fireEvent.change(screen.getByLabelText("Attack team"), {
    target: { value: String(teams[1].id) },
  });
  expect(screen.getByLabelText("Recorded attack")).toHaveTextContent(
    teams[1].name,
  );
  rerender(<CourtInsights teams={teams.slice(0, 2)} />);
  expect(
    screen.getByText(/positions and action sequences were not recorded/i),
  ).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
