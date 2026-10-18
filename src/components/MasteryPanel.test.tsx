import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  MasteryPanel,
  GameMasteryReport,
  MasteryTrainingReport,
} from "./MasteryPanel";
import { emptyRoster, type LeagueTeam } from "../game/types";
import { teamRatings } from "../game/ratings";
const roster = { ...emptyRoster(), PG: 25 };
const team: LeagueTeam = {
  id: 0,
  name: "Kanto",
  roster,
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  ratings: teamRatings(roster),
  abilityVersion: 1,
  abilityMasteryVersion: 1,
  abilityMastery: { 25: 80 },
};
describe("mastery views", () => {
  it("fills progress toward the next milestone rather than the lifetime cap", () => {
    render(<MasteryPanel team={{ ...team, abilityMastery: { 25: 50 } }} />);
    const bar = screen.getByRole("progressbar", {
      name: "Pikachu ability mastery",
    });
    expect(bar).toHaveAttribute("value", "50");
    expect(bar).toHaveAttribute("max", "75");
    expect(bar).toHaveAttribute(
      "aria-valuetext",
      "50.00 of 75 XP toward Practiced",
    );
  });
  it("shows current XP, tier and next tier with the bounded ability explanation", () => {
    render(<MasteryPanel team={team} />);
    expect(screen.getByText("80.00 XP")).toBeInTheDocument();
    expect(screen.getByText("Practiced")).toBeInTheDocument();
    expect(screen.getByText(/120.00 XP to Skilled/)).toBeInTheDocument();
    expect(screen.getByText(/existing ability bonuses/)).toBeInTheDocument();
  });
  it("does not invent XP for legacy teams", () => {
    render(
      <MasteryPanel team={{ ...team, abilityMasteryVersion: undefined }} />,
    );
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByText(/was not recorded/)).toBeInTheDocument();
  });
  it("uses frozen game reports even when current team XP changes", () => {
    const current = { ...team, abilityMastery: { 25: 400 } };
    render(
      <GameMasteryReport
        home={current}
        away={{ name: "Johto" }}
        report={{
          home: [
            {
              pokemonId: 25,
              before: 74.9,
              after: 75.2,
              gained: 0.3,
              levelBefore: "Developing",
              levelAfter: "Practiced",
            },
          ],
          away: [],
        }}
      />,
    );
    expect(screen.getByText(/74.90 → 75.20 XP/)).toBeInTheDocument();
    expect(screen.queryByText(/400.00/)).not.toBeInTheDocument();
  });
  it("shows archived completed training reasons without recalculating the plan", () => {
    render(
      <MasteryTrainingReport
        teams={[team]}
        year={1}
        changes={[
          {
            teamId: 0,
            pokemonId: 25,
            before: 180,
            after: 215,
            gained: 35,
            levelBefore: "Practiced",
            levelAfter: "Skilled",
            focus: "defense",
            breakthrough: true,
            reasons: ["Saved training reason."],
          },
        ]}
      />,
    );
    expect(screen.getByText("Saved training reason.")).toBeInTheDocument();
    expect(screen.getByText(/180.00 → 215.00 XP/)).toBeInTheDocument();
  });
});
