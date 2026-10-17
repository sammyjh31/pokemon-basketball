import { render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { CoachSummary } from "./CoachSummary";
import { teamRatings } from "../game/ratings";
import {
  createEvaluationContext,
  evaluatePlayer,
} from "../game/teamEvaluation";
import type { LeagueTeam } from "../game/types";
afterEach(cleanup);
const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const team: LeagueTeam = {
  id: 0,
  name: "Test",
  roster,
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  coach: { version: 1, id: "misty" },
  ratings: teamRatings(roster),
  evaluationVersion: 1,
  abilityVersion: 1,
};
it("shows the actual shared contributions without replacing OVR", () => {
  render(<CoachSummary team={team} />);
  const table = within(
    screen.getByRole("region", { name: "Shared team evaluation" }),
  ).getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(9);
  const expected = evaluatePlayer(createEvaluationContext(team), 135);
  const row = within(table)
    .getByRole("rowheader", { name: "Jolteon" })
    .closest("tr")!;
  expect(row).toHaveTextContent(expected.score.toFixed(1));
  expect(screen.getByText(/OVR remains a separate rating/)).toBeInTheDocument();
});
it("keeps legacy coach summaries free of new evaluation claims", () => {
  render(<CoachSummary team={{ ...team, evaluationVersion: undefined }} />);
  expect(
    screen.queryByRole("region", { name: "Shared team evaluation" }),
  ).toBeNull();
});
