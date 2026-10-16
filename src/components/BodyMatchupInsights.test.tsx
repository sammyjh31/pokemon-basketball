import { render, screen, fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { MatchupLab } from "./MatchupLab";
import { BodyMatchupInsights } from "./BodyMatchupInsights";
import { simulateMatch } from "../game/match";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
it("explores physical contests and changes the preview when a different defender enters", () => {
  render(<MatchupLab />);
  fireEvent.click(
    screen.getByRole("button", { name: "Open matchup explorer" }),
  );
  const body = screen.getByRole("region", { name: "Physical matchup" });
  expect(body).toHaveTextContent(/post leverage/i);
  expect(body).toHaveTextContent(/turning/i);
  const chance = screen.getByLabelText("Advantage creation chance").textContent;
  fireEvent.change(screen.getByLabelText("Defender"), {
    target: { value: "95" },
  });
  expect(
    screen.getByLabelText("Advantage creation chance").textContent,
  ).not.toBe(chance);
  expect(screen.getByLabelText("Shot make probability")).not.toHaveTextContent(
    "NaN",
  );
});
it("reports only recorded matchup participants and explains conditional probability changes", () => {
  const clubs = createLeague({
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
  const m = simulateMatch(clubs[0], clubs[1], 7);
  const { rerender } = render(
    <BodyMatchupInsights shots={m.insights!.shots} teams={clubs.slice(0, 2)} />,
  );
  expect(
    screen.getByRole("table", { name: "Physical and type matchups" }),
  ).toHaveTextContent(/kg/);
  expect(screen.getByText(/conditional shot chance/i)).toBeInTheDocument();
  expect(
    screen.getByText(/not a counterfactual winning margin/i),
  ).toBeInTheDocument();
  rerender(
    <BodyMatchupInsights
      shots={m.insights!.shots.map((s) => ({ ...s, matchup: undefined }))}
      teams={clubs.slice(0, 2)}
    />,
  );
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText(/not recorded/i)).toBeInTheDocument();
});
