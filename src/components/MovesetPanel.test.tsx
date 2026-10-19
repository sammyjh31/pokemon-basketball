import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { createLeague } from "../game/league";
import { performanceRun } from "../game/seasonPerformance.testUtils";
import { MovesetPanel, MoveUsage, GameMovesReport } from "./MovesetPanel";
import { coachMoves } from "../game/movePolicy";
it("explains automatic move choices, specialization tradeoffs and the next unlock without controls", () => {
  const team = {
    ...createLeague(performanceRun())[0],
    movesetVersion: 1 as const,
  };
  render(<MovesetPanel team={team} pokemonId={team.roster.PG!} />);
  const region = screen.getByRole("region", { name: "Basketball movesets" });
  expect(region).toHaveTextContent(/coach.*automatically/i);
  expect(region).toHaveTextContent(/75 XP/);
  expect(region).toHaveTextContent(/200 XP/);
  expect(within(region).queryByRole("combobox")).not.toBeInTheDocument();
  expect(region).toHaveTextContent(/energy/);
  expect(region).toHaveTextContent(/cooldown/i);
});
it("does not infer moves for historical rules and explains disabled abilities", () => {
  const team = createLeague(performanceRun())[0];
  const view = render(<MovesetPanel team={team} />);
  expect(view.container).toBeEmptyDOMElement();
  view.rerender(
    <MovesetPanel
      team={{
        ...team,
        movesetVersion: 1,
        engineRules: {
          version: 1,
          abilities: false,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      }}
    />,
  );
  expect(screen.getByText(/moves are disabled/i)).toBeInTheDocument();
});
it("reports actual move uses and energy separately from made baskets or passive activations", () => {
  render(
    <MoveUsage
      rows={[
        {
          key: 1,
          label: "Pikachu",
          abilityActivations: {
            offense: 0,
            support: 0,
            defense: 0,
            moves: {
              uses: { "quick-attack": 3 },
              energySpent: 15,
              energyRecovered: 0,
            },
          },
        },
      ]}
    />,
  );
  expect(
    screen.getByRole("region", { name: "Basketball move usage" }),
  ).toHaveTextContent(/Quick Attack ×3/);
  expect(
    screen.getByRole("region", { name: "Basketball move usage" }),
  ).toHaveTextContent(/15.00/);
});
it("shows frozen game assignments without manually configuring a lineup", () => {
  const team = {
      ...createLeague(performanceRun())[0],
      movesetVersion: 1 as const,
    },
    id = team.roster.PG!;
  render(
    <GameMovesReport assignments={{ [`0:${id}`]: coachMoves(team, id) }} />,
  );
  expect(
    screen.getByRole("region", { name: "Game move assignments" }),
  ).toHaveTextContent(/pregame/i);
});
