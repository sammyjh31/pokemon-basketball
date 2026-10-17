import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "../App";
import { initialState } from "../game/state";
import { insightLeague } from "../game/insightAnalysis.testUtils";
import type { LeagueTeam } from "../game/types";

it("refreshes the coach preview from completed games even when the draft has no frozen league teams", () => {
  const state = initialState(7);
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
  state.run.coach = { version: 1, id: "oak" };
  const storage = { getItem: () => null, setItem: () => {} };
  const view = render(<App initial={state} storage={storage} />);
  expect(
    screen.getByRole("region", { name: "Projected five-player chemistry" }),
  ).toHaveTextContent("Earned familiarity 0 / 100");
  const league = insightLeague();
  league.teams[0] = {
    ...league.teams[0],
    roster: state.run.roster,
    chemistryVersion: 1,
    chemistryGrowthVersion: 1,
  } satisfies LeagueTeam;
  const ids = Object.values(state.run.roster) as number[];
  league.chemistryBonds = {
    0: Object.fromEntries(
      ids.flatMap((a, index) =>
        ids
          .slice(index + 1)
          .map((b) => [[a, b].sort((x, y) => x - y).join(":"), 600]),
      ),
    ),
  };
  const completed = {
    ...state,
    run: {
      ...state.run,
      seasonProgress: {
        modelVersion: 1 as const,
        completedRounds: 1,
        playedGames: {},
        result: {
          games: [],
          wins: 1,
          losses: 0,
          mvpId: 65,
          modelVersion: 6 as const,
          league,
        },
      },
    },
  };
  view.rerender(<App key="completed" initial={completed} storage={storage} />);
  expect(
    screen.getByRole("region", { name: "Projected five-player chemistry" }),
  ).toHaveTextContent("Earned familiarity 50 / 100");
  expect(
    screen.getByRole("region", { name: "Projected five-player chemistry" }),
  ).toHaveTextContent("600.0 average retained shared minutes");
  expect(league.teams[0].chemistryBonds).toBeUndefined();
});
