import { DepthScouting } from "./DepthScouting";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { simulateMatch } from "../game/match";
import { createGame } from "../game/arcade/setup";
import { ArcadeResults } from "./ArcadeResults";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { Leaders } from "./LeaguePanel";
import { ScoutReport } from "./ScoutReport";
import type { LeaguePlayer } from "../game/types";

const run = {
  ...createRun("free", false, 11),
  roster: { PG: 25, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
const teams = createLeague(run);
const cells = (table: HTMLElement, name: string | RegExp) =>
  within(within(table).getByRole("rowheader", { name }).closest("tr")!)
    .getAllByRole("cell")
    .map((cell) => cell.textContent);

describe("visible species abilities", () => {
  it("distinguishes current species rules, disabled rules and legacy signatures", () => {
    const mon = POKEMON_BY_ID.get(25)!;
    const { rerender } = render(
      <DepthScouting mon={mon} abilities abilityVersion={1} />,
    );
    expect(screen.getByRole("region")).toHaveTextContent("Static");
    expect(screen.queryByText(/legacy signature/i)).not.toBeInTheDocument();
    rerender(<DepthScouting mon={mon} abilities={false} abilityVersion={1} />);
    expect(screen.getByRole("region")).toHaveTextContent(
      /species abilities are disabled/i,
    );
    rerender(<DepthScouting mon={mon} abilities />);
    expect(screen.getByRole("region")).toHaveTextContent(/legacy signature/i);
    expect(screen.getByRole("region")).not.toHaveTextContent("Static");
  });

  it("scouts the selected species with its canonical ability and basketball effect", () => {
    render(<ScoutReport mon={POKEMON_BY_ID.get(25)!} />);
    const ability = screen.getByRole("region", {
      name: "Pikachu species ability",
    });
    expect(ability).toHaveTextContent("Static");
    expect(ability).toHaveTextContent(/basketball adaptation/i);
    expect(ability).toHaveTextContent(
      /contested jump shots.*2.5 percentage points/i,
    );
  });

  it("shows applied effects in a game box without manufacturing counts for legacy players", () => {
    const match = simulateMatch(teams[0], teams[1], 91);
    Object.assign(match.homeBox[0], {
      abilityActivations: { offense: 2, support: 3, defense: 4 },
    });
    delete match.homeBox[1].abilityActivations;
    Object.assign(match.homeBox[2], {
      abilityActivations: { offense: 0, support: 0, defense: 0 },
    });
    const first = POKEMON_BY_ID.get(match.homeBox[0].pokemonId)!.name;
    const missing = POKEMON_BY_ID.get(match.homeBox[1].pokemonId)!.name;
    const zero = POKEMON_BY_ID.get(match.homeBox[2].pokemonId)!.name;
    render(
      <LeagueBoxScore
        game={{
          id: "ability-box",
          round: 0,
          homeTeamId: teams[0].id,
          awayTeamId: teams[1].id,
          seed: 91,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          overtimePeriods: 0,
        }}
        teams={teams}
        match={match}
        onClose={() => {}}
      />,
    );
    const table = screen.getByRole("table", {
      name: `${teams[0].name} ability activations`,
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .slice(0, 2)
        .map((cell) => cell.textContent),
    ).toEqual(["PLAYER / SEASON", "TOTAL"]);
    expect(cells(table, first).filter((_, index) => index !== 1)).toEqual([
      "9",
      "2",
      "3",
      "4",
    ]);
    expect(cells(table, missing).at(0)).toMatch(/unavailable/i);
    expect(cells(table, zero).filter((_, index) => index !== 1)).toEqual([
      "0",
      "0",
      "0",
      "0",
    ]);
    expect(screen.getAllByText(/including misses/).length).toBeGreaterThan(0);
  });

  it("keeps season and playoff ability counts distinct and follows player filters", () => {
    const match = simulateMatch(teams[0], teams[1], 91);
    const players: LeaguePlayer[] = match.homeBox.slice(0, 2).map((p, i) => ({
      ...p,
      teamName: teams[0].name,
      gamesPlayed: 2,
      gamesStarted: 2,
      highPoints: 10,
      doubleDoubles: 0,
      tripleDoubles: 0,
      playerOfGame: 0,
      abilityActivations: { offense: i + 2, support: 3, defense: 4 },
    }));
    render(<Leaders league={{ teams, players }} postseason />);
    const table = screen.getByRole("table", {
      name: "Playoff ability activations",
    });
    const first = POKEMON_BY_ID.get(players[0].pokemonId)!.name;
    expect(cells(table, first).filter((_, index) => index !== 1)).toEqual([
      "9",
      "2",
      "3",
      "4",
    ]);
    fireEvent.change(screen.getByLabelText("Search playoff players"), {
      target: { value: first },
    });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Per game" }));
    expect(cells(table, first).filter((_, index) => index !== 1)).toEqual([
      "9",
      "2",
      "3",
      "4",
    ]);
  });

  it("shows actual arcade activations separately from scoring totals", () => {
    const state = createGame({ seed: 91, teams: [teams[0], teams[1]] });
    Object.assign(state.players[0].stats, {
      points: 30,
      abilityActivations: { offense: 1, support: 2, defense: 3 },
    });
    render(
      <ArcadeResults
        state={state}
        mvp={state.players[0]}
        onRematch={() => {}}
        onChangeOpponent={() => {}}
        onExit={() => {}}
      />,
    );
    const table = screen.getByRole("table", {
      name: `${teams[0].name} ability activations`,
    });
    expect(
      cells(table, state.players[0].name).filter((_, index) => index !== 1),
    ).toEqual(["6", "1", "2", "3"]);
    const score = screen.getByRole("table", {
      name: `${teams[0].name} exhibition box score`,
    });
    expect(cells(score, new RegExp(state.players[0].name))[1]).toBe("30");
  });
});
