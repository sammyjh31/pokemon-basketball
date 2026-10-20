import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { CoachScoutingSummary } from "./CoachScoutingSummary";
import { GameCounterReport } from "./GameCounterReport";
import { createLeague } from "../game/league";
import { performanceRun } from "../game/seasonPerformance.testUtils";
import { emptyScouting } from "../game/opponentScouting";
import { getCoach } from "../game/trainerCoaches";
it("explains retained personal and inherited reports, roster turnover and opposing coach changes", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 3 });
  teams[0].scoutingSeed = {
    version: 1,
    year: 2,
    coachId: teams[0].coach!.id,
    opponents: {
      1: {
        roster: Object.values(teams[1].roster) as number[],
        opponentName: teams[1].name,
        opponentCoachId: "mom",
        scouting: {
          ...emptyScouting(),
          carried: 1,
          players: {
            25: { attempts: 10, points: 15, rimAttempts: 2, threeAttempts: 3 },
          },
        },
        sourceCoachId: teams[2].coach!.id,
        sourceYear: 1,
        retainedPlayers: 6,
        coachChanged: true,
      },
    },
  };
  render(
    <>
      <CoachScoutingSummary team={teams[0]} />
      <GameCounterReport
        plans={{ home: [], away: [] }}
        teams={teams.slice(0, 2)}
      />
    </>,
  );
  const summary = screen.getByRole("region", {
    name: "Scouting carried into this season",
  });
  expect(summary).toHaveTextContent("1 opponent");
  expect(summary).toHaveTextContent("Pikachu");
  expect(summary).toHaveTextContent("6/8");
  expect(summary).toHaveTextContent("New opposing coach");
  expect(summary).toHaveTextContent(getCoach(teams[2].coach!.id)!.name);
  expect(summary).toHaveTextContent("Club handover");
  expect(
    screen.getByRole("region", { name: "Coach counter scouting" }),
  ).toHaveTextContent("6/8");
  expect(screen.queryByRole("combobox")).toBeNull();
});
it("does not show an old coach's book as the new hire's personal knowledge", () => {
  const team = createLeague(performanceRun())[0];
  team.scoutingSeed = { version: 1, year: 2, coachId: "mom", opponents: {} };
  render(<CoachScoutingSummary team={team} />);
  expect(screen.queryByRole("region")).toBeNull();
});
