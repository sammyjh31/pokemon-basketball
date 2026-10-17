import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { applyTrade } from "../game/franchise";
import { beginRookieDraft } from "../game/rookieDraft";
import {
  CAREER_KEYS,
  type CareerTotals,
  type Franchise,
} from "../game/franchiseTypes";
import { ROSTER_SLOTS, type GameState, type LeagueTeam } from "../game/types";
import { FranchisePanel, type FranchisePanelProps } from "./FranchisePanel";

const emptyTotals = (): CareerTotals =>
  Object.fromEntries(
    CAREER_KEYS.map((key) => [key, 0]),
  ) as unknown as CareerTotals;
function fixture(): GameState {
  const teams: LeagueTeam[] = Array.from({ length: 30 }, (_, id) => ({
    id,
    name:
      id === 0 ? "Your team" : id === 1 ? "Pallet Pioneers" : `Club ${id + 1}`,
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((slot, index) => [slot, id * 8 + index + 1]),
    ) as LeagueTeam["roster"],
    tactic: "balanced",
    defense: "man",
    rotation: "balanced",
    ratings: {
      offense: 60,
      defense: 60,
      overall: 60,
      filled: 5,
      complete: true,
    },
  }));
  const standings = teams.map((team) => ({
    teamId: team.id,
    wins: 50,
    losses: 32,
    pointsFor: 8200,
    pointsAgainst: 8000,
    homeWins: 25,
    awayWins: 25,
    streak: 1,
    lastTen: 5,
  }));
  const finalsMvp = {
    playerId: "0:1",
    pokemonId: 1,
    teamId: 0,
    score: 100,
    value: "25.0 PPG · 6.0 RPG · 5.0 APG",
  };
  const franchise: Franchise = {
    modelVersion: 1,
    year: 1,
    phase: "offseason",
    teams,
    trades: [],
    careers: Array.from({ length: 240 }, (_, index) => ({
      pokemonId: index + 1,
      seasons: 1,
      teamIds: [Math.floor(index / 8)],
      regular: {
        ...emptyTotals(),
        gamesPlayed: 2,
        gamesStarted: 1,
        points: 30,
        fgm: 10,
        fga: 20,
        threePM: 2,
        threePA: 5,
        ftm: 8,
        fta: 10,
        highPoints: 20,
        doubleDoubles: 1,
      },
      playoffs: { ...emptyTotals(), gamesPlayed: 1, points: 8, fgm: 0, fga: 0 },
    })),
    history: [
      {
        year: 1,
        seasonSeed: 99,
        standings,
        rosters: teams.map((team) =>
          ROSTER_SLOTS.map((slot) => team.roster[slot]!),
        ),
        awards: [
          {
            id: "mvp",
            title: "Most Valuable Player",
            pokemonId: 1,
            teamId: 0,
            description: "Season leader",
            value: "15.0 PPG",
          },
        ],
        allLeague: [{ pokemonId: 1, teamId: 0 }],
        allDefense: [{ pokemonId: 1, teamId: 0 }],
        championId: 0,
        runnerUpId: 1,
        runnerUpWins: 2,
        finalsMvp,
      },
    ],
  };
  return {
    version: 3,
    franchise,
    records: {
      spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
      free: { runs: 1, bestWins: 50, perfectSeasons: 0 },
    },
    run: {
      id: "franchise-fixture",
      mode: "free",
      includeLegends: false,
      roster: teams[0].roster,
      offerIds: [],
      rerollsLeft: 0,
      draftSeed: 1,
      seasonSeed: 99,
      tactic: "balanced",
      rotation: "balanced",
      defense: "man",
      result: {
        modelVersion: 3,
        wins: 50,
        losses: 32,
        mvpId: 1,
        games: [],
        league: {
          teams,
          standings,
          players: [],
          games: [],
          awards: [],
          allLeague: [],
          allDefense: [],
        },
      },
      playoffs: {
        modelVersion: 1,
        seeds: [],
        series: [],
        players: [],
        finalsPlayers: [],
        championId: 0,
        finalsMvp,
      },
    },
  };
}
function setup(
  state = fixture(),
  overrides: Partial<FranchisePanelProps> = {},
) {
  const props = {
    state,
    onEnterOffseason: vi.fn(),
    onStartSeason: vi.fn(),
    onTrade: vi.fn(),
    ...overrides,
  };
  return { ...render(<FranchisePanel {...props} />), props };
}

describe("franchise hub", () => {
  it("offers continuation only after completed model-3 playoffs", () => {
    const state = fixture();
    delete state.franchise;
    const { props, rerender } = setup(state);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue as franchise" }),
    );
    expect(props.onEnterOffseason).toHaveBeenCalledOnce();
    rerender(
      <FranchisePanel
        {...props}
        state={{ ...state, run: { ...state.run, playoffs: undefined } }}
      />,
    );
    expect(
      screen.queryByRole("region", { name: "Franchise" }),
    ).not.toBeInTheDocument();
    rerender(
      <FranchisePanel
        {...props}
        state={{
          ...state,
          run: {
            ...state.run,
            result: { ...state.run.result!, modelVersion: 2 },
          },
        }}
      />,
    );
    expect(
      screen.queryByRole("region", { name: "Franchise" }),
    ).not.toBeInTheDocument();
  });

  it("keeps all eight offseason players visible and offers every trading partner", () => {
    const { props } = setup();
    expect(
      within(
        screen.getByRole("list", { name: "Your offseason roster" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(8);
    expect(
      within(screen.getByLabelText("Trade partner")).getAllByRole("option"),
    ).toHaveLength(29);
    expect(
      within(screen.getByLabelText("Player you send")).getAllByRole("option"),
    ).toHaveLength(8);
    expect(
      within(screen.getByLabelText("Player you receive")).getAllByRole(
        "option",
      ),
    ).toHaveLength(8);
    fireEvent.click(screen.getByRole("button", { name: "Start season 2" }));
    expect(props.onStartSeason).toHaveBeenCalledOnce();
  });

  it("filters species-level careers and keeps per-game, totals and playoff scopes separate", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
    const table = screen.getByRole("table", {
      name: /Career player statistics/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(241);
    fireEvent.change(
      screen.getByLabelText("Filter career players by current team"),
      { target: { value: "0" } },
    );
    expect(within(table).getAllByRole("row")).toHaveLength(9);
    fireEvent.change(screen.getByLabelText("Search career players"), {
      target: { value: "Bulbasaur" },
    });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("15.0");
    expect(table).toHaveTextContent("50.0%");
    fireEvent.click(screen.getByRole("button", { name: "Totals" }));
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("30");
    fireEvent.click(screen.getByRole("button", { name: "Playoffs" }));
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("8");
    expect(table).toHaveTextContent("—");
  });

  it("shows defensive career totals and per-36 rates without changing their meaning across scopes", () => {
    const state = fixture();
    Object.assign(state.franchise!.careers[0].regular, {
      gamesPlayed: 2,
      minutes: 60,
      defensiveRebounds: 18,
      steals: 4,
      blocks: 2,
      fouls: 6,
    });
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
    fireEvent.change(screen.getByLabelText("Search career players"), {
      target: { value: "Bulbasaur" },
    });
    const category = screen.getByRole("group", {
      name: "Career stat category",
    });
    fireEvent.click(within(category).getByRole("button", { name: "Defense" }));
    const table = screen.getByRole("table", {
      name: /Career player statistics/,
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent?.replace(/[↑↓↕]/g, "")),
    ).toEqual([
      "PLAYER / CURRENT TEAM",
      "GP",
      "MIN",
      "DREB",
      "STL",
      "BLK",
      "STL+BLK",
      "PF",
      "DREB/36",
      "STL/36",
      "BLK/36",
    ]);
    expect(
      within(table)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual([
      "2",
      "30.0",
      "9.0",
      "2.0",
      "1.0",
      "3.0",
      "3.0",
      "10.8",
      "2.4",
      "1.2",
    ]);
    expect(screen.getByText(/Stocks.*steals plus blocks/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Totals" }));
    expect(
      within(table)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["2", "60", "18", "4", "2", "6", "6", "10.8", "2.4", "1.2"]);
    fireEvent.click(screen.getByRole("button", { name: "Playoffs" }));
    expect(
      within(table)
        .getAllByRole("cell")
        .slice(-3)
        .map((cell) => cell.textContent),
    ).toEqual(["—", "—", "—"]);
    fireEvent.click(
      within(category).getByRole("button", { name: "All stats" }),
    );
    expect(
      within(table).getByRole("button", { name: "Sort careers by points" }),
    ).toBeInTheDocument();
  });

  it("rejects an unfair offer and updates the displayed roster and trade log after an accepted offer", () => {
    const state = fixture();
    const { props, rerender } = setup(state);
    const complete = screen.getByRole("button", { name: "Complete trade" });
    expect(complete).toBeDisabled();
    expect(screen.getByLabelText("Trade offer preview")).toHaveTextContent(
      "Offer declined",
    );
    fireEvent.click(complete);
    expect(props.onTrade).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Player you send"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Player you receive"), {
      target: { value: "10" },
    });
    expect(complete).toBeEnabled();
    expect(screen.getByLabelText("Trade offer preview")).toHaveTextContent(
      "Venusaur",
    );
    expect(screen.getByLabelText("Trade offer preview")).toHaveTextContent(
      "Caterpie",
    );
    fireEvent.click(complete);
    expect(props.onTrade).toHaveBeenCalledWith(1, 3, 10);
    const traded = applyTrade(state, 1, 3, 10);
    rerender(<FranchisePanel {...props} state={traded} />);
    const roster = screen.getByRole("list", { name: "Your offseason roster" });
    expect(roster).toHaveTextContent("Caterpie");
    expect(roster).not.toHaveTextContent("Venusaur");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Caterpie joined your team",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Venusaur joined Pallet Pioneers",
    );
    expect(screen.getByText("Trade history (1)")).toBeInTheDocument();
    rerender(<FranchisePanel {...props} state={traded} disabled />);
    expect(
      screen.getByRole("button", { name: "Start season 2" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Complete trade" }),
    ).toBeDisabled();
    expect(screen.getByLabelText("Trade partner")).toBeDisabled();
  });

  it("includes active-year additions in career stats without counting the archived season twice", () => {
    const state = fixture();
    state.franchise!.phase = "season";
    state.franchise!.year = 2;
    state.run.result!.modelVersion = 4;
    state.run.playoffs = undefined;
    state.run.result!.league!.players = [
      {
        ...emptyTotals(),
        teamId: 0,
        teamName: "Your team",
        playerId: "0:1",
        pokemonId: 1,
        slot: "PG",
        gamesPlayed: 2,
        points: 20,
      },
    ];
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
    fireEvent.change(screen.getByLabelText("Search career players"), {
      target: { value: "Bulbasaur" },
    });
    const table = screen.getByRole("table", {
      name: /Career player statistics/,
    });
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("12.5");
    fireEvent.click(screen.getByRole("button", { name: "Totals" }));
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("50");
    expect(state.franchise!.careers[0].regular.points).toBe(30);
  });

  it("retains a traded player's championship and award affiliations", () => {
    const state = fixture();
    state.franchise!.teams[0].roster = {
      ...state.franchise!.teams[0].roster,
      PG: 9,
    };
    state.franchise!.teams[1].roster = {
      ...state.franchise!.teams[1].roster,
      PG: 1,
    };
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
    fireEvent.change(screen.getByLabelText("Search career players"), {
      target: { value: "Bulbasaur" },
    });
    const player = screen.getByRole("button", {
      name: "View Bulbasaur honors",
    });
    expect(player).toHaveTextContent("Pallet Pioneers");
    fireEvent.click(player);
    const honors = screen.getByRole("region", {
      name: "Bulbasaur career honors",
    });
    expect(honors).toHaveTextContent("Championship ring");
    expect(honors).toHaveTextContent("Most Valuable Player");
    expect(honors).toHaveTextContent("All-League");
    expect(honors).toHaveTextContent("All-Defense");
    expect(honors).toHaveTextContent("Finals MVP");
    expect(honors).toHaveTextContent("Year 1 · Your team");
    expect(honors).not.toHaveTextContent("Pallet Pioneers");
  });

  it("shows archived standings, Finals, awards and the champion's original roster", () => {
    const state = fixture();
    state.franchise!.history[0].standings[1].wins = 60;
    state.franchise!.history[0].standings[1].losses = 22;
    state.franchise!.history[0].standings[2].pointsFor = 8500;
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByLabelText("Archived season")).toHaveValue("1");
    const history = screen.getByRole("region", { name: "Season history" });
    expect(history).toHaveTextContent("4–2");
    expect(history).toHaveTextContent("50–32");
    expect(history).toHaveTextContent("Bulbasaur");
    expect(history).toHaveTextContent(
      /Newly archived seasons preserve player stats and every game/i,
    );
    expect(
      within(
        screen.getByRole("table", { name: "Year 1 final standings" }),
      ).getAllByRole("row"),
    ).toHaveLength(31);
    const rankedTeams = within(
      screen.getByRole("table", { name: "Year 1 final standings" }),
    ).getAllByRole("rowheader");
    expect(rankedTeams[0]).toHaveTextContent("Pallet Pioneers");
    expect(rankedTeams[1]).toHaveTextContent("Club 3");
    expect(rankedTeams[2]).toHaveTextContent("Your team");
    expect(
      within(
        screen.getByRole("list", { name: "Year 1 championship roster" }),
      ).getAllByRole("listitem"),
    ).toHaveLength(8);
  });

  it("allows offseason entry only when the current Finals finish and disables mutations while busy", () => {
    const state = fixture();
    state.franchise!.phase = "season";
    state.franchise!.year = 2;
    state.run.playoffs!.championId = null;
    const { props, rerender } = setup(state);
    expect(
      screen.queryByRole("button", { name: "Enter offseason" }),
    ).not.toBeInTheDocument();
    const finished = {
      ...state,
      run: {
        ...state.run,
        playoffs: { ...state.run.playoffs!, championId: 0 },
      },
    };
    rerender(<FranchisePanel {...props} state={finished} disabled />);
    expect(
      screen.getByRole("button", { name: "Enter offseason" }),
    ).toBeDisabled();
    rerender(<FranchisePanel {...props} state={finished} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter offseason" }));
    expect(props.onEnterOffseason).toHaveBeenCalledOnce();
  });
});

describe("offseason development review", () => {
  function withReport() {
    const state = fixture();
    state.franchise!.modelVersion = 2;
    state.franchise!.offseasons = [
      {
        modelVersion: 1,
        year: 1,
        tradeStart: 0,
        tradeCount: 1,
        players: [
          {
            pokemonId: 1,
            teamId: 0,
            before: 60,
            after: 69,
            minutesPerGame: 31.5,
            impactPer36: 25.2,
            changes: { passing: 12, speed: 6 },
            outcome: "breakout",
            reasons: ["A surprise leap in seasonal form."],
          },
          {
            pokemonId: 9,
            teamId: 1,
            before: 75,
            after: 68,
            minutesPerGame: 24.5,
            impactPer36: 12.1,
            changes: { finishing: -10 },
            outcome: "slump",
            reasons: ["A difficult season reduced finishing."],
          },
        ],
      },
    ];
    state.franchise!.trades = [
      {
        year: 1,
        source: "cpu",
        fromTeamId: 1,
        teamId: 2,
        giveId: 9,
        receiveId: 17,
        reason: "Pallet Pioneers gain spacing; Club 3 gains rim protection.",
      },
    ];
    return state;
  }

  it("requires missing development once before starting the next season", () => {
    const state = fixture();
    const onProcessOffseason = vi.fn();
    const { props, rerender } = setup(state, { onProcessOffseason });
    expect(
      screen.getByRole("button", { name: "Start season 2" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Run offseason development" }),
    );
    expect(onProcessOffseason).toHaveBeenCalledOnce();
    rerender(<FranchisePanel {...props} state={withReport()} />);
    expect(
      screen.queryByRole("button", { name: "Run offseason development" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start season 2" }),
    ).toBeEnabled();
  });

  it("filters development by last-season team and player and exposes skill changes and CPU reasoning", () => {
    setup(withReport());
    fireEvent.click(screen.getByRole("button", { name: "Development report" }));
    const report = screen.getByRole("region", {
      name: "Offseason development report",
    });
    expect(report).toHaveTextContent("60.0 → 69.0");
    expect(report).toHaveTextContent("75.0 → 68.0");
    fireEvent.click(screen.getByText("Bulbasaur development details"));
    expect(report).toHaveTextContent("Passing +12");
    expect(report).toHaveTextContent("A surprise leap in seasonal form.");
    const feed = within(report).getByRole("region", {
      name: "CPU offseason transactions",
    });
    expect(feed).toHaveTextContent("Pallet Pioneers sends Blastoise to Club 3");
    expect(feed).toHaveTextContent("Club 3 sends Pidgeotto to Pallet Pioneers");
    expect(feed).toHaveTextContent(
      "Pallet Pioneers gain spacing; Club 3 gains rim protection.",
    );
    expect(feed).not.toHaveTextContent("your team");
    fireEvent.change(
      screen.getByLabelText("Filter development by last-season team"),
      { target: { value: "1" } },
    );
    expect(report).not.toHaveTextContent("Bulbasaur development details");
    expect(report).toHaveTextContent("Blastoise development details");
    fireEvent.change(screen.getByLabelText("Search development players"), {
      target: { value: "missing" },
    });
    expect(report).toHaveTextContent("No players match these filters.");
  });

  it("retains archival reports during the next season and selects earlier years", () => {
    const state = withReport();
    const first = state.franchise!.offseasons![0];
    state.franchise!.offseasons!.push({
      ...first,
      year: 2,
      players: [{ ...first.players[0], before: 69, after: 72 }],
      tradeStart: 1,
      tradeCount: 0,
    });
    state.franchise!.year = 3;
    state.franchise!.phase = "season";
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Development report" }));
    expect(screen.getByLabelText("Development year")).toHaveValue("2");
    expect(
      screen.getByRole("region", { name: "Offseason development report" }),
    ).toHaveTextContent("69.0 → 72.0");
    fireEvent.change(screen.getByLabelText("Development year"), {
      target: { value: "1" },
    });
    expect(
      screen.getByRole("region", { name: "Offseason development report" }),
    ).toHaveTextContent("60.0 → 69.0");
  });
});

describe("developed offseason scouting and trade attribution", () => {
  it("opens current scouting from the offseason roster and applies a player's development", () => {
    const state = fixture();
    state.franchise!.teams[0].development = { 1: { passing: 30 } };
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Scout Bulbasaur" }));
    const report = screen.getByRole("region", {
      name: "Bulbasaur scouting report",
    });
    const passing = within(report)
      .getByText("Passing", { exact: true })
      .closest("div")!;
    expect(within(passing).getByRole("definition")).toHaveTextContent("84");
    fireEvent.click(
      screen.getByRole("button", { name: "Close scouting report" }),
    );
    expect(
      screen.queryByRole("region", { name: "Bulbasaur scouting report" }),
    ).not.toBeInTheDocument();
  });

  it("does not attribute CPU swaps to the user in the roster status or trade history", () => {
    const state = fixture();
    state.franchise!.trades = [
      {
        year: 1,
        source: "cpu",
        fromTeamId: 1,
        teamId: 2,
        giveId: 9,
        receiveId: 17,
        reason: "Both clubs improve their rotation.",
      },
    ];
    setup(state);
    expect(screen.getByRole("status")).not.toHaveTextContent(
      "joined your team",
    );
    fireEvent.click(screen.getByText("Trade history (1)"));
    const history = screen.getByText("Trade history (1)").closest("details")!;
    expect(history).toHaveTextContent(
      "Pallet Pioneers sends Blastoise to Club 3",
    );
    expect(history).toHaveTextContent(
      "Club 3 sends Pidgeotto to Pallet Pioneers",
    );
  });
});

describe("complete offseason workspace", () => {
  function readyState() {
    const state = fixture();
    state.franchise!.modelVersion = 3;
    state.franchise!.offseasons = [
      { modelVersion: 1, year: 1, tradeStart: 0, tradeCount: 0, players: [] },
    ];
    return state;
  }
  const newCallbacks = () => ({
    onTradePackage: vi.fn(),
    onRoster: vi.fn(),
    onBeginDraft: vi.fn(),
    onAdvanceDraft: vi.fn(),
    onPickRookie: vi.fn(),
  });

  it("opens the free-agent workspace and keeps it locked until the rookie draft finishes", () => {
    const state = readyState();
    const callbacks = {
      ...newCallbacks(),
      onSignFreeAgent: vi.fn(),
      onCpuFreeAgency: vi.fn(),
    };
    setup(state, callbacks);
    fireEvent.click(screen.getByRole("button", { name: "Free agents" }));
    expect(
      screen.getByRole("heading", { name: "Free agents" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run CPU free agency" }),
    ).toBeDisabled();
  });

  it("requires this offseason's rookie draft and forwards beginning and individual picks", () => {
    const state = readyState(),
      callbacks = newCallbacks();
    const { props, rerender } = setup(state, callbacks);
    expect(
      screen.getByRole("button", { name: "Start season 2" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Rookie draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Begin rookie draft" }));
    expect(callbacks.onBeginDraft).toHaveBeenCalledOnce();
    const drafting = beginRookieDraft(state);
    rerender(<FranchisePanel {...props} state={drafting} />);
    expect(
      screen.getByRole("button", { name: "Start season 2" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Search rookie prospects"), {
      target: { value: "Treecko" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Scout Treecko" }));
    fireEvent.change(screen.getByLabelText("Player to release"), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Draft Treecko" }));
    expect(callbacks.onPickRookie).toHaveBeenCalledWith(252, 1);
    const complete = structuredClone(drafting);
    complete.franchise!.rookieDrafts![0].complete = true;
    rerender(<FranchisePanel {...props} state={complete} />);
    fireEvent.click(screen.getByRole("button", { name: "Start season 2" }));
    expect(props.onStartSeason).toHaveBeenCalledOnce();
    complete.franchise!.year = 2;
    rerender(<FranchisePanel {...props} state={{ ...complete }} />);
    expect(
      screen.getByRole("button", { name: "Start season 3" }),
    ).toBeDisabled();
  });

  it("forwards CPU draft progress and prevents trading during a partial draft", () => {
    const state = readyState();
    state.franchise!.rookieDrafts = [
      {
        modelVersion: 1,
        year: 1,
        generation: 3,
        order: [1, 0, ...Array.from({ length: 28 }, (_, index) => index + 2)],
        picks: [],
        complete: false,
        tradeIndex: 0,
      },
    ];
    const callbacks = newCallbacks();
    setup(state, callbacks);
    fireEvent.click(screen.getByRole("button", { name: "Rookie draft" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Advance to your pick" }),
    );
    expect(callbacks.onAdvanceDraft).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Trade market" }));
    expect(
      screen.getByText("Complete the current rookie draft before trading."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Target Caterpie" }),
    ).toBeDisabled();
  });

  it("edits offseason roles and sends accepted packages through the new callbacks", () => {
    const callbacks = newCallbacks();
    const { props } = setup(readyState(), callbacks);
    fireEvent.change(screen.getByLabelText("Point guard player"), {
      target: { value: "6" },
    });
    expect(callbacks.onRoster).toHaveBeenCalledWith(
      expect.objectContaining({
        roster: expect.objectContaining({ PG: 6, B1: 1 }),
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Trade market" }));
    expect(screen.queryByLabelText("Player you send")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Target Caterpie" }));
    fireEvent.click(screen.getByLabelText("Send Venusaur"));
    fireEvent.click(screen.getByLabelText("Send Charizard"));
    fireEvent.click(screen.getByLabelText("Receive Metapod"));
    fireEvent.click(screen.getByRole("button", { name: "Complete trade" }));
    expect(callbacks.onTradePackage).toHaveBeenCalledWith({
      teamId: 1,
      giveIds: [3, 6],
      receiveIds: [10, 11],
    });
    expect(props.onTrade).not.toHaveBeenCalled();
  });

  it("retains released players' career totals and historic honors", () => {
    const state = readyState();
    state.franchise!.teams[0] = {
      ...state.franchise!.teams[0],
      roster: { ...state.franchise!.teams[0].roster, PG: 252 },
    };
    setup(state);
    fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
    fireEvent.change(
      screen.getByLabelText("Filter career players by current team"),
      { target: { value: "released" } },
    );
    const table = screen.getByRole("table", {
      name: /Career player statistics/,
    });
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    const player = screen.getByRole("button", {
      name: "View Bulbasaur honors",
    });
    expect(player).toHaveTextContent("Released");
    expect(within(table).getAllByRole("cell")[0]).toHaveTextContent("15.0");
    fireEvent.click(
      within(
        screen.getByRole("group", { name: "Career stat category" }),
      ).getByRole("button", { name: "Defense" }),
    );
    expect(within(table).getAllByRole("row")).toHaveLength(2);
    expect(player).toHaveTextContent("Released");
    fireEvent.click(player);
    expect(
      screen.getByRole("region", { name: "Bulbasaur career honors" }),
    ).toHaveTextContent("Year 1 · Your team");
  });

  it("keeps the full package transaction history available in the new workspace", () => {
    const state = readyState();
    state.franchise!.trades = [
      {
        year: 1,
        fromTeamId: 1,
        teamId: 2,
        giveId: 9,
        receiveId: 17,
        source: "cpu",
        packageVersion: 1,
        giveIds: [9, 10],
        receiveIds: [17, 18],
      },
    ];
    setup(state, newCallbacks());
    fireEvent.click(screen.getByText("Trade history (1)"));
    const history = screen.getByText("Trade history (1)").closest("details")!;
    expect(history).toHaveTextContent("Blastoise and Caterpie");
    expect(history).toHaveTextContent("Pidgeotto and Pidgeot");
    expect(history).toHaveTextContent("CPU trade");
  });
});

it("keeps recorded ability totals in career browsing and marks unavailable historical detail", () => {
  const state = fixture();
  state.franchise!.careers[0].regular.abilityActivations = {
    offense: 2,
    support: 3,
    defense: 4,
  };
  state.franchise!.careers[0].playoffs.abilityActivations = {
    offense: 1,
    support: 0,
    defense: 0,
  };
  setup(state);
  fireEvent.click(screen.getByRole("button", { name: "Career stats" }));
  fireEvent.change(screen.getByLabelText("Search career players"), {
    target: { value: "Bulbasaur" },
  });
  const table = screen.getByRole("table", {
    name: "Regular-season career ability activations",
  });
  expect(
    within(table)
      .getAllByRole("cell")
      .filter((_, index) => index !== 1)
      .map((cell) => cell.textContent),
  ).toEqual(["9", "2", "3", "4"]);
  fireEvent.click(
    screen.getByRole("button", { name: "Open Bulbasaur career page" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Bulbasaur career" });
  const detail = within(dialog).getByRole("table", {
    name: "Regular-season ability history",
  });
  expect(
    within(detail).getByRole("rowheader", { name: "Year 1" }).closest("tr"),
  ).toHaveTextContent(/unavailable/i);
  expect(
    within(detail)
      .getByRole("rowheader", { name: "Career · recorded games" })
      .closest("tr"),
  ).toHaveTextContent("Overgrow");
  expect(
    within(
      within(detail)
        .getByRole("rowheader", { name: "Career · recorded games" })
        .closest("tr")!,
    )
      .getAllByRole("cell")
      .filter((_, index) => index !== 1)
      .map((cell) => cell.textContent),
  ).toEqual(["9", "2", "3", "4"]);
  fireEvent.click(within(dialog).getByRole("button", { name: "Playoffs" }));
  const playoffs = within(dialog).getByRole("table", {
    name: "Playoff ability history",
  });
  expect(
    within(
      within(playoffs)
        .getByRole("rowheader", { name: "Career · recorded games" })
        .closest("tr")!,
    )
      .getAllByRole("cell")
      .filter((_, index) => index !== 1)
      .map((cell) => cell.textContent),
  ).toEqual(["1", "1", "0", "0"]);
});
