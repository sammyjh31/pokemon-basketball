import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  insightBox,
  insightLeague,
  insightMatch,
  insightShot,
  insightTeams,
} from "../game/insightAnalysis.testUtils";
import { GameInsightsPanel } from "./GameInsightsPanel";
import { SeasonInsightsPanel } from "./SeasonInsightsPanel";

describe("game insights", () => {
  it("filters recorded shots by player and exposes results beyond chart color", () => {
    const match = insightMatch({
      homeBox: [insightBox(), insightBox({ pokemonId: 2, playerId: "0:2" })],
    });
    match.insights!.shots.push(
      insightShot({
        index: 3,
        shooterId: "0:2",
        zone: "three",
        value: 3,
        made: false,
      }),
    );
    render(
      <GameInsightsPanel
        match={match}
        home={insightTeams[0]}
        away={insightTeams[1]}
      />,
    );
    expect(screen.getByText(/schematic.*not tracked/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Shot chart player"), {
      target: { value: "0:2" },
    });
    const chart = screen.getByRole("img", { name: /shot chart/i });
    expect(chart).toHaveAccessibleName(/0 makes.*1 miss/i);
    const log = screen.getByRole("table", {
      name: "Recorded shot events",
      hidden: true,
    });
    expect(within(log).getAllByRole("row", { hidden: true })).toHaveLength(2);
    expect(log).toHaveTextContent("Ivysaur");
    expect(log).toHaveTextContent("Miss");
    expect(log).toHaveTextContent("0:10");
    fireEvent.change(screen.getByLabelText("Shot chart player"), {
      target: { value: "0:8" },
    });
    expect(
      screen.getByText(/No recorded shots for this selection/),
    ).toBeInTheDocument();
  });
  it("shows measured comparisons and discloses historical detail gaps", () => {
    render(
      <GameInsightsPanel
        match={insightMatch({ insights: undefined })}
        home={insightTeams[0]}
        away={insightTeams[1]}
      />,
    );
    expect(
      screen.getByRole("table", { name: "Recorded game comparisons" }),
    ).toHaveTextContent("Turnovers");
    expect(
      screen.getByText(/Home club had 2 fewer turnovers/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Shot locations, lineups and defensive assignments were not recorded/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("img", { name: /shot chart/i }),
    ).not.toBeInTheDocument();
  });
});
describe("season insights", () => {
  it("builds on demand, reports samples, and exposes player game trends with DNPs", async () => {
    const league = insightLeague(2);
    render(
      <SeasonInsightsPanel
        league={league}
        resolveMatch={(game) =>
          insightMatch({
            homeBox: [insightBox({ minutes: game.round ? 0 : 20 })],
            insights: game.round ? undefined : insightMatch().insights,
          })
        }
      />,
    );
    expect(
      screen.queryByRole("table", { name: "Player game trends" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Build season insights" }),
    );
    const table = await screen.findByRole("table", {
      name: "Player game trends",
    });
    expect(table).toHaveTextContent("DNP");
    expect(
      screen.getByText(/1 of 2 games include recorded telemetry/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last 5 team games/)).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /Points by game/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("table", { name: "Five-player lineups" }),
    ).toHaveTextContent("160.0");
  });
  it("allows cancellation before replay and can restart", async () => {
    render(
      <SeasonInsightsPanel
        league={insightLeague(5)}
        resolveMatch={() => insightMatch()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Build season insights" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel analysis" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Analysis cancelled",
      ),
    );
    expect(
      screen.queryByRole("table", { name: "Player game trends" }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Build season insights" }),
    );
    expect(
      await screen.findByRole("table", { name: "Player game trends" }),
    ).toBeInTheDocument();
  });
  it("handles an empty season without charts, undefined names, or NaN", () => {
    const { container } = render(
      <SeasonInsightsPanel league={{ ...insightLeague(0), teams: [] }} />,
    );
    expect(screen.getByText(/No completed games/)).toBeInTheDocument();
    expect(container).not.toHaveTextContent(/NaN|undefined/);
  });
});
