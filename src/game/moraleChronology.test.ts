import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import {
  initialMoraleBanks,
  retainMorale,
  teamsWithMorale,
  withRosterMorale,
} from "./playerMorale";
import { verifyMoraleChronology } from "./moraleChronology";
import type { FranchiseSeason, FranchiseTrade } from "./franchiseTypes";
import type { RookieDraft } from "./rookieDraftTypes";
import type { FreeAgency } from "./freeAgencyTypes";
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
  const teams = createLeague(run).slice(0, 3),
    banks = initialMoraleBanks(teams)!;
  banks[0][65] = {
    score: 75,
    minutes: 32,
    success: 75,
    disruption: 0,
    games: 3,
  };
  banks[1][teams[1].roster.PG!] = {
    score: 30,
    minutes: 12,
    success: 25,
    disruption: -2,
    games: 3,
  };
  const history = [
    {
      year: 1,
      replay: { teams: structuredClone(teams), playoffs: { morale: banks } },
    },
  ] as unknown as FranchiseSeason[];
  return { run, teams, history, final: teamsWithMorale(teams, banks) };
}

describe("morale chronological provenance", () => {
  it("replays both trade directions from donor state, rookies and free agents, then retains once", () => {
    const { run, teams, history, final } = fixture(),
      give = 65,
      receive = teams[1].roster.PG!;
    const trades: FranchiseTrade[] = [
      { year: 1, teamId: 1, giveId: give, receiveId: receive },
    ];
    let current = final.map((team) =>
      team.id === 0
        ? withRosterMorale(
            { ...team, roster: { ...team.roster, PG: receive } },
            team,
            final,
            "trade",
          )
        : team.id === 1
          ? withRosterMorale(
              { ...team, roster: { ...team.roster, PG: give } },
              team,
              final,
              "trade",
            )
          : team,
    );
    expect(current[1].morale![give].score).toBe(71);
    expect(current[0].morale![receive].score).toBe(26);
    const rookieId = 1000,
      freeId = 1001;
    const draft = [
      {
        year: 1,
        tradeIndex: 1,
        picks: [
          { teamId: 0, releasedId: current[0].roster.B3!, pokemonId: rookieId },
        ],
      },
    ] as unknown as RookieDraft[];
    const freeAgency = {
      transactions: [
        {
          year: 1,
          tradeIndex: 1,
          teamId: 1,
          releasedId: current[1].roster.B3!,
          pokemonId: freeId,
        },
      ],
    } as unknown as FreeAgency;
    for (const [id, incoming, kind] of [
      [0, rookieId, "rookie"],
      [1, freeId, "free-agent"],
    ] as const) {
      const old = current;
      current = current.map((team) =>
        team.id === id
          ? withRosterMorale(
              { ...team, roster: { ...team.roster, B3: incoming } },
              team,
              old,
              kind,
            )
          : team,
      );
    }
    const check = (
      clubs: LeagueTeam[],
      phase: "season" | "offseason",
      target = run,
    ) =>
      verifyMoraleChronology(
        target,
        clubs,
        history,
        trades,
        draft,
        freeAgency,
        phase,
      );
    expect(() => check(current, "offseason")).not.toThrow();
    const altered = structuredClone(current);
    altered[1].morale![give].score += 1;
    expect(() => check(altered, "offseason")).toThrow();
    const next = current.map(retainMorale);
    expect(() =>
      check(next, "season", { ...run, leagueTeams: structuredClone(next) }),
    ).not.toThrow();
    const doubled = next.map(retainMorale);
    expect(() =>
      check(doubled, "season", {
        ...run,
        leagueTeams: structuredClone(doubled),
      }),
    ).toThrow();
    const tamperedArchive = structuredClone(history);
    tamperedArchive[0].replay!.teams[0].morale![give].score += 1;
    expect(() =>
      verifyMoraleChronology(
        run,
        current,
        tamperedArchive,
        trades,
        draft,
        freeAgency,
        "offseason",
      ),
    ).toThrow();
  });

  it("starts old summary-only franchises at neutral and rejects later removal of morale", () => {
    const { run, teams, history, final } = fixture();
    const summary = [{ year: 1 }] as FranchiseSeason[];
    expect(() =>
      verifyMoraleChronology(
        { ...run, leagueTeams: teams },
        teams,
        summary,
        [],
        undefined,
        undefined,
        "season",
      ),
    ).not.toThrow();
    const forged = structuredClone(teams);
    forged[0].morale![65].games = 1;
    expect(() =>
      verifyMoraleChronology(
        { ...run, leagueTeams: forged },
        forged,
        summary,
        [],
        undefined,
        undefined,
        "season",
      ),
    ).toThrow();
    const old = final.map(({ morale: _, moraleVersion: __, ...team }) => team);
    expect(() =>
      verifyMoraleChronology(
        { ...run, leagueTeams: old },
        old,
        history,
        [],
        undefined,
        undefined,
        "season",
      ),
    ).toThrow();
  });
});
