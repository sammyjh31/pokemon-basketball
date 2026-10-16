import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  ROSTER_SLOTS,
  type LeaguePlayer,
  type LeagueResult,
  type LeagueTeam,
  type Run,
} from "../game/types";
import { SeasonPanel } from "./SeasonPanel";
import { Leaders } from "./LeaguePanel";

const ratings = {
  offense: 60,
  defense: 60,
  overall: 60,
  filled: 5,
  complete: true,
};
const teams: LeagueTeam[] = [0, 1].map((id) => ({
  id,
  name: id ? "Pallet Pioneers" : "Your team",
  roster: Object.fromEntries(
    ROSTER_SLOTS.map((slot, index) => [slot, id * 8 + index + 1]),
  ) as LeagueTeam["roster"],
  tactic: id ? "pace" : "balanced",
  defense: "man",
  rotation: "balanced",
  ratings,
}));
const players: LeaguePlayer[] = teams.flatMap((team) =>
  ROSTER_SLOTS.map((slot, index) => ({
    teamId: team.id,
    teamName: team.name,
    playerId: `${team.id}:${team.roster[slot]}`,
    pokemonId: team.roster[slot]!,
    slot,
    minutes: 2460,
    points: team.id ? 2460 : 820,
    offensiveRebounds: 82,
    defensiveRebounds: 164,
    assists: 410,
    steals: 82,
    blocks: 82,
    turnovers: 164,
    fgm: 820,
    fga: 1640,
    threePM: 164,
    threePA: 410,
    ftm: 164,
    fta: 205,
    gamesPlayed: 82,
    gamesStarted: index < 5 ? 82 : 0,
    doubleDoubles: 5,
    tripleDoubles: 0,
    highPoints: 40,
    playerOfGame: 10,
    fouls: 164,
    plusMinus: 82,
    rimFgm: 400,
    rimFga: 600,
    midFgm: 256,
    midFga: 630,
  })),
);
const league: LeagueResult = {
  teams,
  players,
  games: Array.from({ length: 82 }, (_, index) => ({
    id: `game-${index}`,
    round: index,
    homeTeamId: 0,
    awayTeamId: 1,
    seed: index + 1,
    homeScore: 80,
    awayScore: 120,
    overtimePeriods: 0,
  })),
  standings: teams.map((team) => ({
    teamId: team.id,
    wins: team.id ? 82 : 0,
    losses: team.id ? 0 : 82,
    pointsFor: team.id ? 9840 : 6560,
    pointsAgainst: team.id ? 6560 : 9840,
    homeWins: team.id ? 41 : 0,
    awayWins: team.id ? 41 : 0,
    streak: team.id ? 82 : -82,
    lastTen: team.id ? 10 : 0,
  })),
  awards: [
    {
      id: "mvp",
      title: "Most Valuable Player",
      pokemonId: 9,
      playerId: "1:9",
      teamId: 1,
      description: "League-wide production.",
      value: "30.0 PPG",
      score: 40,
      finalists: [
        {
          playerId: "1:9",
          teamId: 1,
          pokemonId: 9,
          score: 40,
          value: "30.0 PPG",
        },
        {
          playerId: "0:1",
          teamId: 0,
          pokemonId: 1,
          score: 20,
          value: "10.0 PPG",
        },
      ],
    },
  ],
  allLeague: ["1:9", "0:1"],
  allDefense: ["0:1", "1:9"],
};
function seasonRun(): Run {
  return {
    id: "league-ui",
    mode: "free",
    includeLegends: false,
    roster: teams[0].roster,
    offerIds: [],
    rerollsLeft: 2,
    draftSeed: 1,
    seasonSeed: 2,
    tactic: "balanced",
    rotation: "balanced",
    result: {
      modelVersion: 3,
      league,
      wins: 0,
      losses: 82,
      mvpId: 9,
      mvpTeamId: 1,
      playerStats: players.filter((p) => p.teamId === 0),
      games: league.games.map((game, index) => ({
        index,
        opponentId: 1,
        home: true,
        leagueGameId: game.id,
        winProbability: 0.5,
        teamScore: 80,
        opponentScore: 120,
        won: false,
        overtime: false,
        playerOfGameId: 9,
        playerOfGameTeamId: 1,
      })),
    },
  };
}
const setup = (animate = false) =>
  render(
    <SeasonPanel
      run={seasonRun()}
      ratings={ratings}
      animate={animate}
      onSimulate={() => {}}
    />,
  );

describe("league results", () => {
  it("shows sortable team efficiency and explains estimated denominators", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Team analysis" }));
    const table = screen.getByRole("table", {
      name: "Team efficiency comparison",
    });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent(
      "Pallet Pioneers",
    );
    fireEvent.change(screen.getByLabelText("Analyze team"), {
      target: { value: "1" },
    });
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("90.0");
    expect(screen.getByText(/Estimated possessions = FGA/)).toBeInTheDocument();
  });
  it("shows an opponent as league MVP and keeps new results out of archived team awards", () => {
    setup();
    expect(screen.getByText("LEAGUE MVP")).toBeInTheDocument();
    const mvp = screen.getByText("LEAGUE MVP").parentElement!;
    expect(mvp).toHaveTextContent("Blastoise");
    expect(mvp).toHaveTextContent("Pallet Pioneers");
    expect(
      screen.queryByRole("heading", { name: "Team awards" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Archived recap")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Awards" }));
    expect(
      screen.getByRole("article", { name: "Most Valuable Player award" }),
    ).toHaveTextContent("Pallet Pioneers");
  });

  it("filters player leaders by team and search, then compares team-qualified player identities", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Player leaders" }));
    const table = screen.getByRole("table", {
      name: /League player statistics/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(17);
    fireEvent.change(screen.getByLabelText("Filter players by team"), {
      target: { value: "1" },
    });
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    fireEvent.change(screen.getByLabelText("Search league players"), {
      target: { value: "Blastoise" },
    });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("rowheader")).toHaveTextContent(
      "Pallet Pioneers",
    );
    fireEvent.click(screen.getByRole("button", { name: "Compare players" }));
    fireEvent.change(screen.getByLabelText("First player"), {
      target: { value: "0:1" },
    });
    fireEvent.change(screen.getByLabelText("Second player"), {
      target: { value: "1:9" },
    });
    const comparison = screen.getByRole("table", { name: "Player comparison" });
    expect(comparison).toHaveTextContent("Bulbasaur · Your team");
    expect(comparison).toHaveTextContent("Blastoise · Pallet Pioneers");
    const points = within(comparison)
      .getByRole("rowheader", { name: "Points per game" })
      .closest("tr")!;
    expect(
      within(points)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["10.0", "30.0"]);
  });

  it("hides all league results until the season reveal is complete", () => {
    setup(true);
    expect(
      screen.queryByRole("button", { name: "Standings" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip reveal" }));
    expect(
      screen.getByRole("button", { name: "Standings" }),
    ).toBeInTheDocument();
  });

  it("limits league games to a page and filters their team and round", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "League games" }));
    const table = screen.getByRole("table", { name: "League game results" });
    expect(within(table).getAllByRole("row").length).toBeLessThanOrEqual(31);
    fireEvent.change(screen.getByLabelText("Filter games by round"), {
      target: { value: "1" },
    });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getByRole("button")).toHaveAccessibleName(
      /Pallet Pioneers.*Your team/,
    );
  });
});

describe("league browsing details", () => {
  it("orders standings by wins and opens the selected team's roster", () => {
    setup();
    const table = screen.getByRole("table", { name: "League standings" });
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent(
      "Pallet Pioneers",
    );
    fireEvent.click(
      within(table).getByRole("button", { name: /Pallet Pioneers/ }),
    );
    const roster = screen.getByRole("table", {
      name: "Pallet Pioneers roster and season statistics",
    });
    expect(within(roster).getAllByRole("row")).toHaveLength(9);
    expect(
      within(roster).getByRole("rowheader", { name: /Blastoise/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Run & gun · Man to man/)).toBeInTheDocument();
  });

  it("removes insufficient samples from qualified percentage leaders without hiding the full pool by default", () => {
    const run = seasonRun();
    run.result!.league = {
      ...league,
      players: league.players.map((p) =>
        p.playerId === "1:9"
          ? { ...p, threePA: 1, threePM: 1 }
          : p.playerId === "1:10"
            ? { ...p, gamesPlayed: 57 }
            : p,
      ),
    };
    render(
      <SeasonPanel
        run={run}
        ratings={ratings}
        animate={false}
        onSimulate={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Player leaders" }));
    const table = screen.getByRole("table", {
      name: /League player statistics/,
    });
    fireEvent.click(
      within(table).getByRole("button", {
        name: "Sort league by three point percentage",
      }),
    );
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("Blastoise");
    fireEvent.click(screen.getByLabelText("Qualified leaders only"));
    expect(
      within(table).queryByRole("rowheader", { name: /Blastoise/ }),
    ).not.toBeInTheDocument();
    expect(
      within(table).queryByRole("rowheader", { name: /Caterpie/ }),
    ).not.toBeInTheDocument();
    expect(within(table).getAllByRole("row")).toHaveLength(15);
  });

  it("shows simulation progress and prevents a second submission", () => {
    const run = seasonRun();
    run.result = null;
    render(
      <SeasonPanel
        run={run}
        ratings={ratings}
        animate={false}
        simulating
        progress={{ completed: 315, total: 1230 }}
        onSimulate={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Simulate season" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("progressbar", { name: "League simulation progress" }),
    ).toHaveAttribute("value", "315");
    expect(screen.getByRole("status")).toHaveTextContent("315 / 1,230");
  });
});

describe("defensive player leaders", () => {
  const defensePlayers: LeaguePlayer[] = [
    {
      ...players[0],
      gamesPlayed: 60,
      minutes: 1200,
      defensiveRebounds: 240,
      steals: 60,
      blocks: 30,
      fouls: 120,
    },
    {
      ...players[1],
      teamId: 1,
      teamName: "Pallet Pioneers",
      playerId: "1:2",
      gamesPlayed: 10,
      minutes: 100,
      defensiveRebounds: 50,
      steals: 20,
      blocks: 10,
      fouls: 20,
    },
    {
      ...players[2],
      gamesPlayed: 0,
      minutes: 0,
      defensiveRebounds: 0,
      steals: 0,
      blocks: 0,
      fouls: 0,
    },
  ];

  it("ranks defensive production and keeps per-36 rates stable when switching to totals", () => {
    render(<Leaders league={{ teams, players: defensePlayers }} />);
    fireEvent.click(screen.getByRole("button", { name: "Defense" }));
    const table = screen.getByRole("table", {
      name: /League player statistics/,
    });
    expect(within(table).getAllByRole("rowheader")[0]).toHaveTextContent(
      "Ivysaur",
    );
    const bulbasaur = within(table)
      .getByRole("rowheader", { name: /Bulbasaur/ })
      .closest("tr")!;
    expect(
      within(bulbasaur)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "60",
      "20.0",
      "4.0",
      "1.0",
      "0.5",
      "1.5",
      "2.0",
      "7.2",
      "1.8",
      "0.9",
    ]);
    expect(screen.getByText(/Stocks.*steals.*blocks/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Totals" }));
    expect(within(table).getAllByRole("rowheader")[0]).toHaveTextContent(
      "Bulbasaur",
    );
    expect(
      within(bulbasaur)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "60",
      "1,200",
      "240",
      "60",
      "30",
      "90",
      "120",
      "7.2",
      "1.8",
      "0.9",
    ]);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Sort league by steals per 36 minutes",
      }),
    );
    expect(within(table).getAllByRole("rowheader")[0]).toHaveTextContent(
      "Ivysaur",
    );
    expect(within(table).getAllByRole("rowheader")[2]).toHaveTextContent(
      "Venusaur",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Sort league by steals per 36 minutes",
      }),
    );
    expect(within(table).getAllByRole("rowheader")[0]).toHaveTextContent(
      "Bulbasaur",
    );
    expect(within(table).getAllByRole("rowheader")[2]).toHaveTextContent(
      "Venusaur",
    );
    const noMinutes = within(table)
      .getByRole("rowheader", { name: /Venusaur/ })
      .closest("tr")!;
    expect(
      within(noMinutes)
        .getAllByRole("cell")
        .slice(-3)
        .map((cell) => cell.textContent),
    ).toEqual(["—", "—", "—"]);
  });

  it("retains filters and qualification when moving between all stats and defense", () => {
    render(<Leaders league={{ teams, players: defensePlayers }} />);
    fireEvent.click(screen.getByRole("button", { name: "Defense" }));
    fireEvent.click(screen.getByLabelText("Qualified leaders only"));
    const table = screen.getByRole("table", {
      name: /League player statistics/,
    });
    expect(within(table).getAllByRole("rowheader")).toHaveLength(1);
    expect(within(table).getByRole("rowheader")).toHaveTextContent("Bulbasaur");
    fireEvent.click(screen.getByLabelText("Qualified leaders only"));
    fireEvent.change(screen.getByLabelText("Filter players by team"), {
      target: { value: "1" },
    });
    fireEvent.change(screen.getByLabelText("Search league players"), {
      target: { value: "Ivysaur" },
    });
    fireEvent.click(screen.getByRole("button", { name: "All stats" }));
    expect(within(table).getAllByRole("rowheader")).toHaveLength(1);
    expect(within(table).getByRole("rowheader")).toHaveTextContent("Ivysaur");
    expect(
      screen.getByRole("button", { name: "Sort league by points" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Defense" }));
    expect(screen.getByLabelText("Search league players")).toHaveValue(
      "Ivysaur",
    );
    expect(screen.getByLabelText("Filter players by team")).toHaveValue("1");
    expect(
      screen.getByRole("button", { name: "Sort league by defensive rebounds" }),
    ).toBeInTheDocument();
  });

  it("uses only the supplied playoff totals without a regular-season qualification threshold", () => {
    render(
      <Leaders
        league={{
          teams,
          players: [
            {
              ...defensePlayers[1],
              gamesPlayed: 2,
              minutes: 36,
              defensiveRebounds: 8,
              steals: 3,
              blocks: 1,
              fouls: 4,
            },
          ],
        }}
        postseason
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Defense" }));
    expect(
      screen.queryByLabelText("Qualified leaders only"),
    ).not.toBeInTheDocument();
    const table = screen.getByRole("table", {
      name: /Playoff player statistics/,
    });
    expect(
      within(table)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "2",
      "18.0",
      "4.0",
      "1.5",
      "0.5",
      "2.0",
      "2.0",
      "8.0",
      "3.0",
      "1.0",
    ]);
    expect(
      screen.getByRole("button", {
        name: "Sort playoffs by blocks per 36 minutes",
      }),
    ).toBeInTheDocument();
  });
});

describe("short local season leaders", () => {
  it("scales appearance and shot-attempt qualifications to the configured season", () => {
    render(
      <Leaders
        league={{
          teams,
          format: {
            teamCount: 4,
            gamesPerTeam: 14,
            playoffTeams: 4,
            bestOf: 1,
          },
          players: [
            { ...players[0], gamesPlayed: 10, fga: 52, fgm: 26 },
            { ...players[1], gamesPlayed: 9, fga: 100, fgm: 90 },
            { ...players[2], gamesPlayed: 14, fga: 51, fgm: 50 },
          ],
        }}
      />,
    );
    fireEvent.click(screen.getByLabelText("Qualified leaders only"));
    fireEvent.click(
      screen.getByRole("button", {
        name: "Sort league by field goal percentage",
      }),
    );
    const table = screen.getByRole("table", {
      name: /League player statistics/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(
      within(table).getByRole("rowheader", { name: /Bulbasaur/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Qualified leaders require 10 games/),
    ).toHaveTextContent("52 FGA");
  });
});
