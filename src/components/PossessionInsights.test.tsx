import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { PossessionInsightsPanel } from "./PossessionInsightsPanel";
import { mergePossessionInsights } from "../game/possessionAnalysis";
import {
  emptyPossessionPlayer,
  emptyPossessionTeam,
} from "../game/possessionTypes";
const detail = () => ({
  version: 1 as const,
  teams: [
    {
      ...emptyPossessionTeam(0),
      points: 100,
      possessions: 80,
      transitionPoints: 12,
      secondChancePoints: 9,
    },
  ],
  players: [
    {
      ...emptyPossessionPlayer(0, "0:65"),
      potentialAssists: 8,
      assists: 5,
      assistPoints: 12,
      expectedAssistPoints: 10.3,
      screenAssists: 2,
      boxOuts: 3,
      reboundChances: 10,
      defensiveRebounds: 4,
      offensiveRebounds: 2,
    },
  ],
});
it("adds real samples and preserves inputs, including zero-minute players", () => {
  const first = detail(),
    copy = JSON.stringify(first);
  const empty = { version: 1 as const, teams: [], players: [] };
  const merged = mergePossessionInsights(
    mergePossessionInsights(empty, first),
    first,
  );
  expect(merged.teams[0]).toMatchObject({
    games: 2,
    points: 200,
    possessions: 160,
  });
  expect(merged.players[0]).toMatchObject({
    games: 2,
    potentialAssists: 16,
    assistPoints: 24,
  });
  expect(JSON.stringify(first)).toBe(copy);
});
it("shows creation and rebound totals with definitions and unavailable history", () => {
  const { rerender } = render(
    <PossessionInsightsPanel
      detail={detail()}
      teams={[{ id: 0, name: "Kanto" }]}
    />,
  );
  expect(
    screen.getByRole("table", { name: "Possession scoring" }),
  ).toHaveTextContent("125.0");
  const player = screen.getByRole("table", {
    name: "Shot creation and rebounding",
  });
  expect(within(player).getByText("Alakazam")).toBeInTheDocument();
  expect(player).toHaveTextContent("12");
  expect(
    screen.getByText(/potential assist.*official field-goal attempt/i),
  ).toBeInTheDocument();
  rerender(<PossessionInsightsPanel teams={[]} />);
  expect(screen.getByText(/not recorded.*games/i)).toBeInTheDocument();
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.getByText(/manually played games/i)).toBeInTheDocument();
  expect(screen.queryByText(/Start a new season/i)).not.toBeInTheDocument();
});
