import { expect, it } from "vitest";
import { verifyChemistryChronology } from "./chemistryChronology";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { pairKey } from "./teammateChemistry";
import type { FranchiseSeason, FranchiseTrade } from "./franchiseTypes";
import type { LeagueTeam, Run } from "./types";

function fixture() {
  const run: Run = {
    ...createRun("free", true, 837),
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  };
  const teams = createLeague(run);
  const a = teams[0].roster.PG!,
    b = teams[0].roster.SG!,
    x = teams[1].roster.PG!,
    y = teams[1].roster.SG!,
    z = teams[2].roster.PG!;
  const bonds = Object.fromEntries(teams.map((team) => [team.id, {}]));
  bonds[0] = { [pairKey(a, b)]: 100 };
  bonds[1] = { [pairKey(x, y)]: 80 };
  const history = [
    {
      year: 1,
      rosters: teams.map((t) => Object.values(t.roster)),
      replay: {
        teams: structuredClone(teams),
        playoffs: { chemistryBonds: bonds },
      },
    },
  ] as unknown as FranchiseSeason[];
  return { run, teams, history, a, b, x, y, z };
}
const copy = (teams: LeagueTeam[]) => structuredClone(teams);

it("reconciles package trades, split pairs and reunions in recorded order while preserving old memories", () => {
  const { run, teams, history, a, b, x, y, z } = fixture();
  const trades: FranchiseTrade[] = [
    {
      year: 1,
      teamId: 1,
      packageVersion: 1,
      giveId: a,
      receiveId: x,
      giveIds: [a, b].sort((a, b) => a - b),
      receiveIds: [x, y].sort((a, b) => a - b),
    },
    {
      year: 1,
      source: "cpu",
      fromTeamId: 1,
      teamId: 2,
      giveId: b,
      receiveId: z,
      reason: "Test split",
    },
    {
      year: 1,
      source: "cpu",
      fromTeamId: 1,
      teamId: 2,
      giveId: z,
      receiveId: b,
      reason: "Test reunion",
    },
  ];
  const current = copy(teams);
  const give = trades[0].giveIds!,
    receive = trades[0].receiveIds!;
  for (const team of [current[0], current[1]])
    for (const slot of Object.keys(
      team.roster,
    ) as (keyof typeof team.roster)[]) {
      const before = team.roster[slot]!;
      const index = (team.id === 0 ? give : receive).indexOf(before);
      if (index !== -1)
        team.roster[slot] = (team.id === 0 ? receive : give)[index];
    }
  current[0].chemistryBonds = { [pairKey(a, b)]: 100, [pairKey(x, y)]: 80 };
  current[1].chemistryBonds = { [pairKey(a, b)]: 100, [pairKey(x, y)]: 80 };
  expect(() =>
    verifyChemistryChronology(
      run,
      current,
      history,
      trades,
      undefined,
      undefined,
      "offseason",
    ),
  ).not.toThrow();
  current[1].chemistryBonds[pairKey(a, b)] = 200;
  expect(() =>
    verifyChemistryChronology(
      run,
      current,
      history,
      trades,
      undefined,
      undefined,
      "offseason",
    ),
  ).toThrow();
});

it("adopts empty history after old summary-only seasons and independently checks both current team banks", () => {
  const { run, teams } = fixture();
  const history = [
    { year: 1, rosters: teams.map((team) => Object.values(team.roster)) },
  ] as unknown as FranchiseSeason[];
  const next = { ...run, leagueTeams: copy(teams) };
  const current = copy(teams);
  expect(() =>
    verifyChemistryChronology(
      next,
      current,
      history,
      [],
      undefined,
      undefined,
      "season",
    ),
  ).not.toThrow();
  const key = pairKey(teams[0].roster.PG!, teams[0].roster.SG!);
  next.leagueTeams[0].chemistryBonds![key] = 1;
  current[0].chemistryBonds![key] = 1;
  expect(() =>
    verifyChemistryChronology(
      next,
      current,
      history,
      [],
      undefined,
      undefined,
      "season",
    ),
  ).toThrow();
});

it("rejects dropping growth rules after a season has already earned shared minutes", () => {
  const { run, teams, history } = fixture();
  const historical = copy(teams);
  for (const team of historical) {
    delete team.chemistryGrowthVersion;
    delete team.chemistryBonds;
  }
  expect(() =>
    verifyChemistryChronology(
      { ...run, leagueTeams: historical },
      historical,
      history,
      [],
      undefined,
      undefined,
      "season",
    ),
  ).toThrow();
});
