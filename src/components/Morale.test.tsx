import { render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import App from "../App";
import { GameMoraleReport, MoralePanel } from "./MoralePanel";
import { moraleAssessment } from "../game/playerMorale";
import { CoachSummary } from "./CoachSummary";
import { LeagueBoxScore } from "./LeagueBoxScore";
import { snapshotMorale } from "../game/playerMorale";
import { simulateMatch } from "../game/match";
import { insightTeams, insightLeague } from "../game/insightAnalysis.testUtils";
import { initialState } from "../game/state";
import type { LeagueTeam } from "../game/types";

const morale = (score: number) => ({
  score,
  minutes: 12,
  success: 25,
  disruption: -5,
  games: 4,
});
const team = (): LeagueTeam => ({
  ...insightTeams[0],
  moraleVersion: 1,
  chemistryVersion: 1,
  chemistryGrowthVersion: 1,
  coach: { version: 1, id: "oak" },
  morale: Object.fromEntries(
    Object.values(insightTeams[0].roster).map((id) => [id!, morale(25)]),
  ),
});

it("explains current morale, expectations and automatic support without changing base ratings", () => {
  const t = team();
  const view = render(<CoachSummary team={t} />);
  const panel = screen.getByRole("region", { name: "Player morale" });
  expect(within(panel).getAllByText("25 / 100")).toHaveLength(8);
  expect(panel).toHaveTextContent(/Expected.*Recent/);
  expect(panel).toHaveTextContent(/Coach fit/);
  expect(panel).toHaveTextContent(/Recent team success/);
  expect(panel).toHaveTextContent(/Transition/);
  expect(panel).toHaveTextContent(/Automatic response/);
  expect(panel).toHaveTextContent(/temporary execution/i);
  expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
  view.rerender(<CoachSummary team={{ ...t, moraleVersion: undefined }} />);
  expect(
    screen.queryByRole("region", { name: "Player morale" }),
  ).not.toBeInTheDocument();
});

it("reads the latest completed morale bank in the current coach preview", () => {
  const state = initialState(7);
  const t = team();
  state.run.roster = t.roster;
  state.run.coach = t.coach;
  state.run.moraleVersion = 1;
  const league = insightLeague();
  league.teams[0] = t;
  league.morale = {
    0: Object.fromEntries(
      Object.values(t.roster).map((id) => [id!, morale(72)]),
    ),
  };
  state.run.seasonProgress = {
    modelVersion: 1,
    completedRounds: 1,
    playedGames: {},
    result: {
      games: [],
      wins: 1,
      losses: 0,
      mvpId: t.roster.PG!,
      modelVersion: 6,
      league,
    },
  };
  const storage = { getItem: () => null, setItem: () => {} };
  const view = render(<App initial={state} storage={storage} />);
  const panel = screen.getByRole("region", { name: "Player morale" });
  expect(
    within(panel).getAllByText("72 / 100", { selector: ".morale-status b" }),
  ).toHaveLength(8);
  expect(panel).toHaveTextContent("Appointed captain");
  expect(Object.values(t.morale!).every((p) => p.score === 25)).toBe(true);
  const playoffMorale = {
    0: Object.fromEntries(
      Object.values(t.roster).map((id) => [id!, morale(81)]),
    ),
  };
  view.rerender(
    <App
      key="playoff"
      initial={{
        ...state,
        run: {
          ...state.run,
          playoffs: {
            modelVersion: 2,
            seeds: [],
            series: [],
            players: [],
            finalsPlayers: [],
            championId: null,
            finalsMvp: null,
            morale: playoffMorale,
          },
        },
      }}
      storage={storage}
    />,
  );
  expect(
    within(screen.getByRole("region", { name: "Player morale" })).getAllByText(
      "81 / 100",
      { selector: ".morale-status b" },
    ),
  ).toHaveLength(8);
});

it("replays historical morale from the fixture and refreshes changed snapshots", () => {
  const home = team();
  const away = {
    ...team(),
    ...insightTeams[1],
    moraleVersion: 1 as const,
    chemistryVersion: 1 as const,
    chemistryGrowthVersion: 1 as const,
    morale: Object.fromEntries(
      Object.values(insightTeams[1].roster).map((id) => [id!, morale(25)]),
    ),
  };
  const snapshot = snapshotMorale(home, away)!;
  const expected = simulateMatch(home, away, 71, { morale: snapshot });
  const stale = [home, away].map((t) => ({
    ...t,
    morale: Object.fromEntries(
      Object.keys(t.morale!).map((id) => [id, morale(95)]),
    ),
  }));
  const fixture = {
    id: "morale-history",
    round: 0,
    homeTeamId: home.id,
    awayTeamId: away.id,
    seed: 71,
    homeScore: expected.homeScore,
    awayScore: expected.awayScore,
    overtimePeriods: expected.overtimePeriods,
    morale: snapshot,
  };
  const view = render(
    <LeagueBoxScore game={fixture} teams={stale} onClose={() => {}} />,
  );
  const report = screen.getByRole("region", { name: "Game morale report" });
  expect(report).toHaveTextContent(
    "Pregame factors and automatic responses are frozen",
  );
  const row = expected.moraleReport!.home[0];
  expect(report).toHaveTextContent(
    `This game: ${row.before.toFixed(1)} → ${row.after.toFixed(1)}`,
  );
  expect(report).not.toHaveTextContent("95 / 100");
  const changed = snapshotMorale(stale[0], stale[1])!;
  view.rerender(
    <LeagueBoxScore
      game={{ ...fixture, morale: changed }}
      teams={stale}
      onClose={() => {}}
    />,
  );
  expect(report).toHaveTextContent("95 / 100");
});

it("shows the appointed captain and distinct personality reactions without manual controls", () => {
  render(<MoralePanel team={{ ...team(), personalityVersion: 1 }} />);
  const panel = screen.getByRole("region", { name: "Player morale" });
  expect(panel).toHaveTextContent("Appointed captain");
  expect(panel).toHaveTextContent("Ambition");
  expect(panel).toHaveTextContent("Loyalty");
  expect(panel).toHaveTextContent("Resilience");
  expect(panel).toHaveTextContent("Coachability");
  expect(panel).toHaveTextContent("Leadership");
  expect(panel).toHaveTextContent(/minutes.*results.*transition/i);
  expect(within(panel).queryByRole("button")).not.toBeInTheDocument();
});
it("reads historical captain identity and support only from the frozen report", () => {
  const t = team();
  const row = { ...moraleAssessment(t, 1), before: 25, after: 28 };
  const captain = {
    captainId: 2,
    score: 77,
    style: "Encourager" as const,
    moraleSupport: 1.5,
    cohesionBonus: 1,
    reasons: ["Trusted by these teammates before tipoff."],
  };
  render(
    <GameMoraleReport
      home={t}
      away={insightTeams[1]}
      report={{
        home: [row],
        away: [],
        captains: { home: captain, away: { ...captain, captainId: 9 } },
      }}
    />,
  );
  const report = screen.getByRole("region", { name: "Game morale report" });
  expect(report).toHaveTextContent("Appointed captain: Ivysaur");
  expect(report).toHaveTextContent("Trusted by these teammates before tipoff.");
  expect(report).toHaveTextContent("+1.5");
});
