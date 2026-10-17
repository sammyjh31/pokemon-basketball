import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { CoachSummary } from "./CoachSummary";
import { insightTeams } from "../game/insightAnalysis.testUtils";

it("explains the projected five and retains basketball chemistry when abilities are disabled", () => {
  const team = {
    ...insightTeams[0],
    chemistryVersion: 1 as const,
    abilityVersion: 1 as const,
    coach: { version: 1 as const, id: "oak" },
    roster: {
      PG: 311,
      SG: 312,
      SF: 65,
      PF: 68,
      C: 95,
      B1: null,
      B2: null,
      B3: null,
    },
  };
  const view = render(<CoachSummary team={team} />);
  const projection = screen.getByRole("region", {
    name: "Projected five-player chemistry",
  });
  expect(projection).toHaveTextContent("Cohesion");
  expect(projection).toHaveTextContent("Plus / Minus");
  expect(projection).toHaveTextContent("Plusle + Minun");
  expect(
    within(projection).getAllByRole("listitem").length,
  ).toBeGreaterThanOrEqual(5);
  view.rerender(
    <CoachSummary
      team={{
        ...team,
        engineRules: {
          version: 1,
          abilities: false,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      }}
    />,
  );
  expect(projection).toHaveTextContent("Cohesion");
  expect(projection).toHaveTextContent("Ability combinations are disabled");
  expect(projection).not.toHaveTextContent("Plus / Minus");
  view.rerender(
    <CoachSummary team={{ ...team, chemistryVersion: undefined }} />,
  );
  expect(
    screen.queryByRole("region", { name: "Projected five-player chemistry" }),
  ).not.toBeInTheDocument();
});
