import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SCHEDULE } from "../data/opponents";
import {
  ROSTER_SLOTS,
  type Run,
  type SeasonPlayer,
  type TeamRatings,
} from "../game/types";
import { SeasonPanel } from "./SeasonPanel";

const ratings: TeamRatings = {
  offense: 60,
  defense: 60,
  overall: 60,
  filled: 8,
  complete: true,
};
const players: SeasonPlayer[] = ROSTER_SLOTS.map((slot, index) => ({
  pokemonId: index + 1,
  slot,
  minutes: 2460,
  points: index === 0 ? 1640 : index === 1 ? 820 : 0,
  offensiveRebounds: 82,
  defensiveRebounds: 164,
  assists: index === 1 ? 410 : 82,
  steals: 82,
  blocks: 0,
  turnovers: 82,
  fgm: index === 0 ? 656 : index === 1 ? 328 : 0,
  fga: index < 2 ? 1312 : 0,
  threePM: 0,
  threePA: 0,
  ftm: index === 0 ? 328 : index === 1 ? 164 : 0,
  fta: index === 0 ? 410 : index === 1 ? 164 : 0,
  gamesPlayed: 82,
  gamesStarted: index < 5 ? 82 : 0,
  doubleDoubles: index === 0 ? 10 : 0,
  tripleDoubles: 0,
  highPoints: index === 0 ? 34 : 20,
  playerOfGame: index === 0 ? 82 : 0,
}));
const makeRun = (): Run => ({
  id: "results-ui",
  mode: "free",
  includeLegends: true,
  roster: { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, B1: 6, B2: 7, B3: 8 },
  offerIds: [],
  rerollsLeft: 2,
  draftSeed: 1,
  seasonSeed: 2,
  tactic: "balanced",
  rotation: "balanced",
  result: {
    modelVersion: 2,
    wins: 82,
    losses: 0,
    mvpId: 1,
    playerStats: players,
    awards: [
      {
        id: "mvp",
        title: "Most Valuable Player",
        pokemonId: 1,
        description: "Led the team in overall production.",
        value: "20.0 PPG",
      },
      {
        id: "defense",
        title: "Defensive Player",
        pokemonId: 2,
        description: "Led the defense.",
        value: "1.0 SPG",
      },
      {
        id: "sixth",
        title: "Sixth Player",
        pokemonId: 6,
        description: "Top reserve.",
        value: "30.0 MPG",
      },
      {
        id: "scoring",
        title: "Scoring Leader",
        pokemonId: 1,
        description: "Most total points.",
        value: "1,640 PTS",
      },
      {
        id: "playmaking",
        title: "Playmaker",
        pokemonId: 2,
        description: "Most total assists.",
        value: "410 AST",
      },
      {
        id: "rebounding",
        title: "Rebounding Leader",
        pokemonId: 1,
        description: "Most total rebounds.",
        value: "246 REB",
      },
    ],
    games: SCHEDULE.map((match) => ({
      ...match,
      winProbability: 0.6,
      teamScore: 30,
      opponentScore: 20,
      won: true,
      overtime: false,
      playerOfGameId: 1,
      overtimePeriods: 0,
      possessions: 90,
      boxScore: players.map((player) => ({
        ...player,
        minutes: 30,
        points: player.pokemonId === 1 ? 20 : player.pokemonId === 2 ? 10 : 0,
        offensiveRebounds: 1,
        defensiveRebounds: 2,
        assists: 1,
        steals: 1,
        blocks: 0,
        turnovers: 1,
        fgm: player.pokemonId === 1 ? 8 : player.pokemonId === 2 ? 4 : 0,
        fga: player.pokemonId < 3 ? 16 : 0,
        ftm: player.pokemonId === 1 ? 4 : player.pokemonId === 2 ? 2 : 0,
        fta: player.pokemonId === 1 ? 5 : player.pokemonId === 2 ? 2 : 0,
      })),
    })),
  },
});

beforeEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: false }),
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("season player results", () => {
  it("requires all eight roster spots before allowing simulation", () => {
    const run = makeRun();
    run.result = null;
    run.roster.B3 = null;
    render(
      <SeasonPanel
        run={run}
        ratings={ratings}
        animate={false}
        onSimulate={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Simulate season" }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("7 of 8 roster spots filled"),
    ).toBeInTheDocument();
  });

  it("sorts all eight players by points per game, supports alternate sorting and totals", () => {
    render(
      <SeasonPanel
        run={makeRun()}
        ratings={ratings}
        animate={false}
        onSimulate={() => {}}
      />,
    );
    const table = screen.getByRole("table", {
      name: /Season player statistics/,
    });
    const rows = () => within(table).getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(8);
    expect(within(rows()[0]).getByRole("rowheader")).toHaveTextContent(
      "Bulbasaur",
    );
    expect(within(rows()[0]).getAllByRole("cell")[0]).toHaveTextContent("20.0");
    fireEvent.click(
      within(table).getByRole("button", { name: "Sort by assists" }),
    );
    expect(within(rows()[0]).getByRole("rowheader")).toHaveTextContent(
      "Ivysaur",
    );
    expect(
      within(table).getByRole("columnheader", { name: "AST" }),
    ).toHaveAttribute("aria-sort", "descending");
    fireEvent.click(screen.getByRole("button", { name: "Totals" }));
    expect(within(rows()[0]).getAllByRole("cell")[0]).toHaveTextContent("820");
    fireEvent.click(
      within(table).getByRole("button", { name: "Sort by assists" }),
    );
    expect(within(rows()[0]).getByRole("rowheader")).toHaveTextContent(
      "Bulbasaur",
    );
  });

  it("shows combined rebounds, true shooting, and a dash for percentages with no attempts", () => {
    render(
      <SeasonPanel
        run={makeRun()}
        ratings={ratings}
        animate={false}
        onSimulate={() => {}}
      />,
    );
    const table = screen.getByRole("table", {
      name: /Season player statistics/,
    });
    const bulbasaur = within(table)
      .getByRole("rowheader", { name: /Bulbasaur/ })
      .closest("tr")!;
    const cells = within(bulbasaur).getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("3.0");
    expect(cells[9]).toHaveTextContent("50.0%");
    expect(cells[10]).toHaveTextContent("—");
    expect(cells[11]).toHaveTextContent("80.0%");
    expect(cells[12]).toHaveTextContent("54.9%");
    const venusaur = within(table)
      .getByRole("rowheader", { name: /Venusaur/ })
      .closest("tr")!;
    expect(
      within(venusaur)
        .getAllByRole("cell")
        .slice(9, 13)
        .every((cell) => cell.textContent === "—"),
    ).toBe(true);
  });

  it("keeps player stats, awards, recap and game detail hidden until the reveal completes", () => {
    vi.useFakeTimers();
    render(
      <SeasonPanel
        run={makeRun()}
        ratings={ratings}
        animate
        onSimulate={() => {}}
      />,
    );
    act(() => vi.advanceTimersByTime(45));
    expect(screen.getAllByTestId("game-result")).toHaveLength(1);
    expect(
      screen.queryByRole("table", { name: /Season player statistics/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Team awards" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Copy recap" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /View box score/ }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip reveal" }));
    expect(
      screen.getByRole("table", { name: /Season player statistics/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Team awards" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("article", { name: /award$/ })).toHaveLength(6);
  });

  it("preserves archived scores and MVP without inventing statistics for old saves", () => {
    const run = makeRun();
    delete run.result!.modelVersion;
    delete run.result!.playerStats;
    delete run.result!.awards;
    run.result!.games.forEach((game) => {
      delete game.boxScore;
    });
    render(
      <SeasonPanel
        run={run}
        ratings={{ ...ratings, complete: false, filled: 5 }}
        animate={false}
        onSimulate={() => {}}
      />,
    );
    expect(screen.getAllByTestId("game-result")).toHaveLength(82);
    expect(screen.getByTestId("season-record")).toHaveTextContent("82–0");
    expect(screen.getByText(/archived recap/i)).toBeInTheDocument();
    expect(screen.getByText(/new eight-player season/i)).toBeInTheDocument();
    expect(screen.getByText("Bulbasaur")).toBeInTheDocument();
    expect(
      screen.queryByRole("table", { name: /Season player statistics/ }),
    ).not.toBeInTheDocument();
  });

  it("opens an accessible box score with coherent totals, traps focus, and restores it on Escape", () => {
    render(
      <SeasonPanel
        run={makeRun()}
        ratings={ratings}
        animate={false}
        onSimulate={() => {}}
      />,
    );
    const opener = screen.getAllByRole("button", { name: /View box score/ })[0];
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog", { name: /Game 1 box score/ });
    const close = within(dialog).getByRole("button", {
      name: "Close box score",
    });
    expect(close).toHaveFocus();
    const table = within(dialog).getByRole("table", {
      name: /Game 1 player box score/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(10);
    const totalRow = within(table)
      .getByRole("rowheader", { name: "Team totals" })
      .closest("tr")!;
    expect(within(totalRow).getAllByRole("cell")[0]).toHaveTextContent("240");
    expect(within(totalRow).getAllByRole("cell")[1]).toHaveTextContent("30");
    fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
    expect(dialog.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

it("explains the earlier team simulation while preserving its team awards", () => {
  render(
    <SeasonPanel
      run={makeRun()}
      ratings={ratings}
      animate={false}
      onSimulate={() => {}}
    />,
  );
  expect(
    screen.getByText(/This saved season uses the earlier team simulation/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Team awards" }),
  ).toBeInTheDocument();
  expect(
    screen.queryByRole("button", { name: "Player leaders" }),
  ).not.toBeInTheDocument();
});
