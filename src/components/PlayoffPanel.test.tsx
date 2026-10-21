import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { simulateMatch } from "../game/match";
import type {
  PlayoffMode,
  Playoffs,
  PlayoffSeries,
} from "../game/playoffTypes";
import {
  ROSTER_SLOTS,
  type LeaguePlayer,
  type LeagueResult,
  type Run,
} from "../game/types";
import { SeasonPanel } from "./SeasonPanel";
import { PlayoffPanel } from "./PlayoffPanel";
import "../test/preloadPanels";

const baseRun = {
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
const teams = createLeague(baseRun);
const emptyPlayers: LeaguePlayer[] = teams.flatMap((team) =>
  ROSTER_SLOTS.map((slot) => ({
    teamId: team.id,
    teamName: team.name,
    playerId: `${team.id}:${team.roster[slot]}`,
    pokemonId: team.roster[slot]!,
    slot,
    minutes: 0,
    points: 0,
    offensiveRebounds: 0,
    defensiveRebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fgm: 0,
    fga: 0,
    threePM: 0,
    threePA: 0,
    ftm: 0,
    fta: 0,
    gamesPlayed: 0,
    gamesStarted: 0,
    doubleDoubles: 0,
    tripleDoubles: 0,
    highPoints: 0,
    playerOfGame: 0,
    fouls: 0,
    plusMinus: 0,
    rimFgm: 0,
    rimFga: 0,
    midFgm: 0,
    midFga: 0,
  })),
);
const league: LeagueResult = {
  teams,
  games: [],
  players: emptyPlayers.map((p) => ({ ...p, gamesPlayed: 82, points: 8200 })),
  standings: teams.map((team) => ({
    teamId: team.id,
    wins: 70 - team.id,
    losses: 12 + team.id,
    pointsFor: 9000 - team.id,
    pointsAgainst: 8000,
    homeWins: 35,
    awayWins: 35 - team.id,
    streak: 1,
    lastTen: 5,
  })),
  awards: [],
  allLeague: [],
  allDefense: [],
};
const pairings = [
  [0, 15],
  [7, 8],
  [3, 12],
  [4, 11],
  [1, 14],
  [6, 9],
  [2, 13],
  [5, 10],
];
function postseason(): Playoffs {
  return {
    modelVersion: 1,
    seeds: league.standings.slice(0, 16).map((s, i) => ({
      seed: i + 1,
      teamId: s.teamId,
      wins: s.wins,
      losses: s.losses,
    })),
    series: [8, 4, 2, 1].flatMap((count, round) =>
      Array.from({ length: count }, (_, index) => ({
        id: `playoffs-${round}-${index}`,
        round: round as PlayoffSeries["round"],
        index,
        higherSeedId: round === 0 ? pairings[index][0] : null,
        lowerSeedId: round === 0 ? pairings[index][1] : null,
        higherSeedWins: 0,
        lowerSeedWins: 0,
        winnerId: null,
        games: [],
      })),
    ),
    players: emptyPlayers.filter((p) => p.teamId < 16),
    finalsPlayers: [],
    championId: null,
    finalsMvp: null,
  };
}
function seasonRun(playoffs?: Playoffs): Run {
  return {
    ...baseRun,
    playoffs,
    result: {
      modelVersion: 3,
      league,
      wins: 70,
      losses: 12,
      mvpId: 65,
      games: [],
    },
  };
}
function setup(
  playoffs?: Playoffs,
  options: { animate?: boolean; simulating?: boolean } = {},
) {
  const run = seasonRun(playoffs);
  function Harness() {
    const [requested, setRequested] = useState<PlayoffMode | "none">("none");
    return (
      <>
        <output aria-label="Requested playoff action">{requested}</output>
        <SeasonPanel
          run={run}
          ratings={teams[0].ratings}
          animate={options.animate ?? false}
          onSimulate={() => {}}
          onPlayoffs={setRequested}
          playoffSimulating={options.simulating}
          playoffProgress={{ completed: 3, total: 8 }}
        />
      </>
    );
  }
  return render(<Harness />);
}
const panel = () => screen.getByRole("region", { name: "Playoffs" });

describe("playoff presentation", () => {
  it("starts with readable round matchups on a phone", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    try {
      render(
        <PlayoffPanel
          league={league}
          seasonSeed={11}
          playoffs={postseason()}
          onAdvance={() => {}}
        />,
      );
      expect(
        screen.getByRole("button", { name: "Round matchups" }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(
        screen.getAllByRole("button", { name: /^View .* series/ }),
      ).toHaveLength(8);
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("lets a round view browse future matchups and return to the full bracket", () => {
    render(
      <PlayoffPanel
        league={league}
        seasonSeed={11}
        playoffs={postseason()}
        onAdvance={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Round matchups" }));
    expect(
      screen.getAllByRole("button", { name: /^View .* series/ }),
    ).toHaveLength(8);
    fireEvent.click(
      screen.getByRole("button", { name: "Browse Quarterfinals" }),
    );
    expect(
      screen.getAllByRole("button", { name: /^View .* series/ }),
    ).toHaveLength(4);
    fireEvent.click(
      screen.getByRole("button", { name: /View Quarterfinals series 2:/ }),
    );
    expect(
      screen.getByRole("region", { name: "Selected playoff series" }),
    ).toHaveTextContent("Awaiting previous round");
    fireEvent.click(screen.getByRole("button", { name: "Full bracket" }));
    expect(
      screen.getAllByRole("button", { name: /^View .* series/ }),
    ).toHaveLength(15);
    expect(
      screen.getByRole("button", { name: /View Quarterfinals series 2:/ }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  it("can return from a future round to the current round", () => {
    render(
      <PlayoffPanel
        league={league}
        seasonSeed={11}
        playoffs={postseason()}
        onAdvance={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Round matchups" }));
    fireEvent.click(screen.getByRole("button", { name: "Browse Finals" }));
    fireEvent.click(
      screen.getByRole("button", { name: /View Finals series 1:/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Back to current round" }),
    );
    expect(
      screen.getByRole("button", { name: "Browse First round" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("region", { name: "Selected playoff series" }),
    ).toHaveTextContent(teams[0].name);
    expect(
      screen.getAllByRole("button", { name: /^View .* series/ }),
    ).toHaveLength(8);
  });
  it("shows the selected matchup's actual roster and series wins, including shorter local series", () => {
    const playoffs = postseason();
    playoffs.format = {
      teamCount: 30,
      gamesPerTeam: 82,
      playoffTeams: 16,
      bestOf: 3,
    };
    playoffs.series[0].higherSeedWins = 1;
    render(
      <PlayoffPanel
        league={league}
        seasonSeed={11}
        playoffs={playoffs}
        onAdvance={() => {}}
      />,
    );
    const matchup = () =>
      screen.getByRole("region", { name: "Series matchup" });
    expect(
      within(matchup()).getByRole("img", { name: "Alakazam" }),
    ).toBeInTheDocument();
    expect(
      within(matchup()).getByLabelText(`${teams[0].name}: 1 of 2 wins needed`),
    ).toHaveTextContent("1");
    fireEvent.click(
      screen.getByRole("button", { name: /View Quarterfinals series 1:/ }),
    );
    expect(within(matchup()).queryByRole("img")).not.toBeInTheDocument();
    expect(within(matchup()).getAllByText("To be decided")).toHaveLength(2);
  });

  it("tracks every local friend, including nonzero team IDs, elimination and championship ownership", () => {
    const managers = [
      { name: "Sam", teamId: 1 },
      { name: "Alex", teamId: 7 },
      { name: "Jo", teamId: 24 },
    ];
    const playoffs = postseason();
    const props = { league, seasonSeed: 11, managers, onAdvance: () => {} };
    const view = render(<PlayoffPanel {...props} playoffs={playoffs} />);
    expect(
      screen.queryByLabelText("Your playoff status"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Sam's playoff status")).toHaveTextContent(
      "Qualified · Seed 2",
    );
    expect(screen.getByLabelText("Jo's playoff status")).toHaveTextContent(
      "Did not qualify",
    );
    expect(screen.getByLabelText("Sam's playoff status")).toHaveTextContent(
      teams[1].name,
    );
    const alexSeries = screen.getByRole("button", {
      name: /View First round series 2:/,
    });
    expect(
      within(alexSeries).getByText(teams[7].name).closest(".playoff-team"),
    ).toHaveClass("is-user");
    const finished = structuredClone(playoffs);
    finished.series[1].winnerId = 8;
    finished.series[1].lowerSeedWins = 4;
    finished.championId = 1;
    finished.series[14] = {
      ...finished.series[14],
      higherSeedId: 1,
      lowerSeedId: 2,
      higherSeedWins: 4,
      winnerId: 1,
    };
    view.rerender(<PlayoffPanel {...props} playoffs={finished} />);
    expect(screen.getByLabelText("Alex's playoff status")).toHaveTextContent(
      "Eliminated · First round",
    );
    expect(screen.getByLabelText("Sam's playoff status")).toHaveTextContent(
      "Champion · Seed 2",
    );
    expect(
      screen.getByRole("article", { name: "Playoff champion" }),
    ).toHaveTextContent("Sam wins the championship!");
    view.rerender(
      <PlayoffPanel {...props} playoffs={{ ...finished, championId: 0 }} />,
    );
    expect(
      screen.getByRole("article", { name: "Playoff champion" }),
    ).toHaveTextContent("CPU-managed team");
  });

  it("reveals the complete seeded bracket only after the season and keeps future rounds visible", () => {
    setup(undefined, { animate: true });
    expect(
      screen.queryByRole("region", { name: "Playoffs" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip reveal" }));
    const playoff = panel();
    expect(
      within(playoff).getAllByRole("button", { name: /^View .* series \d/ }),
    ).toHaveLength(15);
    expect(
      within(playoff).getByRole("button", {
        name: /View First round series 1:/,
      }),
    ).toHaveTextContent(teams[15].name);
    expect(
      within(playoff).getByRole("button", { name: /View Finals series 1:/ }),
    ).toHaveTextContent("TBD");
    expect(
      within(playoff).getByLabelText("Your playoff status"),
    ).toHaveTextContent("Qualified · Seed 1");
    expect(within(playoff).queryByText("Finals MVP")).not.toBeInTheDocument();
    expect(
      within(playoff).getByRole("region", {
        name: "Scrollable playoff bracket",
      }),
    ).toHaveAttribute("tabindex", "0");
  });

  it("offers each advancement mode and disables all advancement while work is running", () => {
    const view = setup();
    for (const [label, mode] of [
      ["Play next slate", "game"],
      ["Finish round", "round"],
      ["Finish playoffs", "all"],
    ]) {
      fireEvent.click(within(panel()).getByRole("button", { name: label }));
      expect(
        screen.getByLabelText("Requested playoff action"),
      ).toHaveTextContent(mode);
    }
    view.unmount();
    setup(undefined, { simulating: true });
    for (const label of [
      "Play next slate",
      "Finish round",
      "Finish playoffs",
    ]) {
      expect(
        within(panel()).getByRole("button", { name: label }),
      ).toBeDisabled();
    }
    expect(
      within(panel()).getByRole("progressbar", {
        name: "Playoff simulation progress",
      }),
    ).toHaveAttribute("value", "3");
  });

  it("shows all 128 playoff players with zero-denominator dashes and no regular-season qualification filter", () => {
    setup();
    fireEvent.click(
      within(panel()).getByRole("button", { name: "Playoff player stats" }),
    );
    const table = within(panel()).getByRole("table", {
      name: /Playoff player statistics/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(129);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("—");
    expect(within(table).getAllByRole("row")[1]).not.toHaveTextContent("100.0");
    expect(
      within(panel()).queryByLabelText("Qualified leaders only"),
    ).not.toBeInTheDocument();
    expect(
      within(panel()).getByText(/No playoff games played yet/),
    ).toBeInTheDocument();
  });

  it("filters, searches and sorts postseason-only averages and totals", () => {
    const playoffs = postseason();
    playoffs.players = playoffs.players.map((p) =>
      p.playerId === "0:65" ? { ...p, gamesPlayed: 2, points: 28 } : p,
    );
    setup(playoffs);
    fireEvent.click(
      within(panel()).getByRole("button", { name: "Playoff player stats" }),
    );
    fireEvent.change(
      within(panel()).getByLabelText("Filter playoff players by team"),
      { target: { value: "0" } },
    );
    const table = within(panel()).getByRole("table", {
      name: /Playoff player statistics/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    fireEvent.change(within(panel()).getByLabelText("Search playoff players"), {
      target: { value: "Alakazam" },
    });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("14.0");
    fireEvent.click(within(panel()).getByRole("button", { name: "Totals" }));
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("28");
    fireEvent.change(within(panel()).getByLabelText("Search playoff players"), {
      target: { value: "" },
    });
    fireEvent.click(
      within(table).getByRole("button", { name: "Sort playoffs by points" }),
    );
    expect(within(table).getAllByRole("row").at(-1)).toHaveTextContent(
      "Alakazam",
    );
  });

  it("opens the selected series game with both teams and postseason context, then restores focus", () => {
    const playoffs = postseason();
    const match = simulateMatch(teams[0], teams[15], 91);
    playoffs.series[0].games.push({
      id: "playoff-game-1",
      round: 0,
      homeTeamId: 0,
      awayTeamId: 15,
      seed: 91,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      overtimePeriods: match.overtimePeriods,
    });
    setup(playoffs);
    fireEvent.click(
      within(panel()).getByRole("button", {
        name: /View First round series 1:/,
      }),
    );
    const opener = within(panel()).getByRole("button", {
      name: /View playoff box score.*Game 1/,
    });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("First round · Game 1");
    expect(dialog).not.toHaveTextContent("ROUND 1");
    for (const team of [teams[0], teams[15]]) {
      const table = within(dialog).getByRole("table", {
        name: `${team.name} player box score`,
      });
      expect(within(table).getAllByRole("row")).toHaveLength(10);
    }
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("announces elimination while keeping the rest of the tournament available", () => {
    const playoffs = postseason();
    playoffs.series[0] = {
      ...playoffs.series[0],
      lowerSeedWins: 4,
      winnerId: 15,
    };
    setup(playoffs);
    expect(
      within(panel()).getByLabelText("Your playoff status"),
    ).toHaveTextContent("Eliminated · First round");
    expect(
      within(panel()).getByRole("button", { name: "Finish playoffs" }),
    ).toBeEnabled();
    expect(within(panel()).queryByText("Finals MVP")).not.toBeInTheDocument();
  });

  it("moves keyboard context to the selected future series and back to its bracket position", () => {
    setup();
    const series = within(panel()).getByRole("button", {
      name: /View Quarterfinals series 2:/,
    });
    fireEvent.click(series);
    const details = within(panel()).getByRole("region", {
      name: "Selected playoff series",
    });
    expect(within(details).getByRole("heading")).toHaveFocus();
    expect(details).toHaveTextContent(
      "This matchup will be set when the previous round finishes.",
    );
    fireEvent.click(
      within(details).getByRole("button", { name: "Back to bracket" }),
    );
    expect(series).toHaveFocus();
  });

  it("lets a team outside the top 16 watch and advance the tournament", () => {
    const playoffs = postseason();
    playoffs.seeds = playoffs.seeds.map((entry) =>
      entry.teamId === 0 ? { ...entry, teamId: 16 } : entry,
    );
    playoffs.players = emptyPlayers.filter(
      (p) => p.teamId >= 1 && p.teamId <= 16,
    );
    playoffs.series[0] = { ...playoffs.series[0], higherSeedId: 16 };
    setup(playoffs);
    expect(
      within(panel()).getByLabelText("Your playoff status"),
    ).toHaveTextContent("Did not qualify");
    fireEvent.click(
      within(panel()).getByRole("button", { name: "Finish playoffs" }),
    );
    expect(screen.getByLabelText("Requested playoff action")).toHaveTextContent(
      "all",
    );
  });

  it("awards the champion and Finals MVP only at completion and uses the Finals stat line", () => {
    const playoffs = postseason();
    playoffs.championId = 0;
    playoffs.finalsMvp = {
      playerId: "0:65",
      pokemonId: 65,
      teamId: 0,
      score: 150,
      value: "25.0 PPG · 6.0 RPG · 5.0 APG",
    };
    playoffs.series[14] = {
      ...playoffs.series[14],
      higherSeedId: 0,
      lowerSeedId: 1,
      higherSeedWins: 4,
      winnerId: 0,
    };
    setup(playoffs);
    const award = within(panel()).getByRole("article", { name: "Finals MVP" });
    expect(award).toHaveTextContent("Alakazam");
    expect(award).toHaveTextContent("25.0 PPG · 6.0 RPG · 5.0 APG");
    expect(
      within(panel()).getByLabelText("Your playoff status"),
    ).toHaveTextContent("Champion · Seed 1");
    expect(
      within(panel()).getByRole("button", { name: "Finish playoffs" }),
    ).toBeDisabled();
  });

  it("keeps a completed reveal visible when only playoff state changes", () => {
    const run = seasonRun();
    const props = {
      ratings: teams[0].ratings,
      animate: true,
      onSimulate: () => {},
      onPlayoffs: () => {},
    };
    const view = render(<SeasonPanel run={run} {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Skip reveal" }));
    view.rerender(
      <SeasonPanel run={{ ...run, playoffs: postseason() }} {...props} />,
    );
    expect(panel()).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Skip reveal" }),
    ).not.toBeInTheDocument();
  });
});
