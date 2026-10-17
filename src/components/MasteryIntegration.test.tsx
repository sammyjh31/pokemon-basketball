import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createRun } from "../game/draft";
import { createLeague } from "../game/league";
import { snapshotMastery } from "../game/abilityMastery";
import { simulateMatch } from "../game/match";
import type { LeagueResult, LeagueTeam } from "../game/types";
import { LeaguePanel } from "./LeaguePanel";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { FranchisePanel } from "./FranchisePanel";
const run = {
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
const teams = createLeague(run);
const bank = (team: LeagueTeam, xp: number) =>
  Object.fromEntries(Object.values(team.roster).map((id) => [id!, xp]));
const league: LeagueResult = {
  teams,
  games: [],
  players: [],
  standings: [],
  awards: [],
  allLeague: [],
  allDefense: [],
  abilityMastery: { 0: bank(teams[0], 80) },
};
describe("mastery integration", () => {
  it("uses supplied postseason banks in team rosters rather than opening-season XP", () => {
    render(
      <LeaguePanel
        league={league}
        mastery={{ 0: bank(teams[0], 700) }}
        year={3}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Team rosters" }));
    const mastery = screen.getByRole("region", { name: "Ability mastery" });
    expect(within(mastery).getAllByText("700.00 XP")).toHaveLength(8);
    expect(
      within(mastery).getAllByText("Master", { exact: true }),
    ).toHaveLength(8);
  });
  it("renders a frozen game report from the scheduled snapshot after current XP has changed", () => {
    const before = teams
      .slice(0, 2)
      .map((t) => ({ ...t, abilityMastery: bank(t, t.id === 0 ? 74.9 : 80) }));
    const mastery = snapshotMastery(before[0], before[1])!;
    const match = simulateMatch(before[0], before[1], 71, { mastery });
    const current = before.map((t) => ({ ...t, abilityMastery: bank(t, 400) }));
    render(
      <LeagueBoxScore
        game={{
          id: "frozen",
          round: 1,
          homeTeamId: 0,
          awayTeamId: 1,
          seed: 71,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
          overtimePeriods: match.overtimePeriods,
          mastery,
        }}
        teams={current}
        onClose={() => {}}
      />,
    );
    const report = screen.getByRole("region", { name: "Game ability mastery" });
    expect(within(report).getAllByText(/^74.90 → /)).toHaveLength(8);
    expect(within(report).queryByText(/^400.00/)).not.toBeInTheDocument();
    expect(current[0].abilityMastery).toEqual(bank(current[0], 400));
  });
  it("uses current regular-season banks in the franchise mastery tab", () => {
    const state = {
      version: 3 as const,
      run: {
        ...run,
        leagueTeams: teams,
        seasonProgress: {
          modelVersion: 1 as const,
          completedRounds: 1,
          playedGames: {},
          result: { games: [], wins: 0, losses: 0, mvpId: 65, league },
        },
      },
      records: {
        spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
        free: { runs: 0, bestWins: 0, perfectSeasons: 0 },
      },
      franchise: {
        modelVersion: 3 as const,
        year: 2,
        phase: "season" as const,
        teams,
        history: [],
        trades: [],
        careers: [],
      },
    };
    render(
      <FranchisePanel
        state={state}
        onEnterOffseason={() => {}}
        onStartSeason={() => {}}
        onTrade={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ability mastery" }));
    expect(screen.getAllByText("80.00 XP")).toHaveLength(8);
  });
});

it("filters generic league news for both nonzero local human clubs", () => {
  const games = [
    {
      id: "g0",
      round: 0,
      homeTeamId: 0,
      awayTeamId: 1,
      seed: 1,
      homeScore: 100,
      awayScore: 90,
      overtimePeriods: 0,
    },
    {
      id: "g1",
      round: 0,
      homeTeamId: 2,
      awayTeamId: 3,
      seed: 2,
      homeScore: 90,
      awayScore: 99,
      overtimePeriods: 0,
    },
  ];
  render(<LeaguePanel league={{ ...league, games }} yourTeamIds={[1, 3]} />);
  fireEvent.click(screen.getByRole("button", { name: "League news" }));
  fireEvent.click(screen.getByLabelText("Your teams only"));
  expect(screen.getAllByRole("article")).toHaveLength(2);
  expect(
    screen.getByText(`${teams[1].name} · Week 1 recap`),
  ).toBeInTheDocument();
  expect(
    screen.getByText(`${teams[3].name} · Week 1 recap`),
  ).toBeInTheDocument();
  expect(
    screen.queryByText(`${teams[0].name} · Week 1 recap`),
  ).not.toBeInTheDocument();
});
