import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { localSeasonBuilder } from "./localSeason";
import { seasonBuilder, resolveSeasonMatch } from "./season";
import {
  replaySeasonProgress,
  nextFranchiseFixture,
} from "./interactiveSeason";
import {
  createPlayoffs,
  simulatePlayoffs,
  replayPlayoffs,
  playoffGameCount,
  resolvePlayoffMatch,
} from "./playoffs";
import { resolveArchivedMatch } from "./archive";
import { validateLeagueTeams } from "./franchiseValidation";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";
import { finishedGame } from "./officialGame.testUtils";
import type { FranchiseSeason } from "./franchiseTypes";
import type { Run } from "./types";

const runFixture = (): Run => ({
  ...createRun("free", true, 973),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
const format = {
  teamCount: 4,
  gamesPerTeam: 14,
  playoffTeams: 4,
  bestOf: 1,
} as const;

describe("persistent chemistry lifecycle", () => {
  it("freezes sequential pregame contexts, earns once, and replays partial prefixes exactly", () => {
    const run = runFixture(),
      teams = createLeague(run);
    const before = structuredClone(teams);
    const job = seasonBuilder(
      {
        ...run,
        leagueTeams: teams,
        seasonProgress: {
          modelVersion: 1,
          completedRounds: 2,
          playedGames: {},
        },
      },
      2,
    );
    job.fixtures.forEach(job.play);
    const result = job.finish();
    expect(teams).toEqual(before);
    expect(result.league!.teams).toEqual(before);
    expect(
      Object.values(result.league!.chemistryBonds![0]).some((v) => v > 0),
    ).toBe(true);
    expect(
      result
        .league!.games.slice(0, 15)
        .every((g) =>
          [...g.chemistry!.home, ...g.chemistry!.away].every((v) => v === 0),
        ),
    ).toBe(true);
    expect(
      result
        .league!.games.slice(15)
        .every(
          (g) =>
            g.chemistry!.home.some((v) => v > 0) &&
            g.chemistry!.away.some((v) => v > 0),
        ),
    ).toBe(true);
    expect(() => job.play(job.fixtures[0])).toThrow();
    const partial = {
      ...run,
      leagueTeams: teams,
      seasonProgress: {
        modelVersion: 1 as const,
        completedRounds: 2,
        playedGames: {},
        result,
      },
    };
    expect(replaySeasonProgress(partial, 2, {})).toEqual(result);
    const next = nextFranchiseFixture(partial)!;
    expect(
      [...next.chemistry!.home, ...next.chemistry!.away].some((v) => v > 0),
    ).toBe(true);
    for (const game of result.games) {
      const fixture = result.league!.games.find(
        (f) => f.id === game.leagueGameId,
      )!;
      const replay = resolveSeasonMatch(fixture, teams);
      expect(game.boxScore).toEqual(
        game.home ? replay.homeBox : replay.awayBox,
      );
    }
    const official = officialGameFromArcade(
      finishedGame(next, teams),
      next,
      teams,
    );
    expect(validateOfficialGame(official, next, teams)).toEqual(official);
    const completed = replaySeasonProgress(partial, 3, { [next.id]: official });
    const userMinutes =
      official.match.chemistryMinutes![next.homeTeamId === 0 ? "home" : "away"];
    for (const [key, minutes] of Object.entries(userMinutes))
      expect(completed.league!.chemistryBonds![0][key]).toBe(
        Math.round(
          ((result.league!.chemistryBonds![0][key] ?? 0) + minutes) * 100,
        ) / 100,
      );
    expect(replaySeasonProgress(partial, 3, { [next.id]: official })).toEqual(
      completed,
    );
    const stale = structuredClone(official);
    stale.chemistry!.home.fill(0);
    expect(() => validateOfficialGame(stale, next, teams)).toThrow();
  });

  it("inherits regular-season history into playoffs and freezes archive boxes", () => {
    const run = runFixture(),
      teams = createLeague(run).slice(0, 4);
    const job = localSeasonBuilder(teams, format, run.seasonSeed);
    job.fixtures.forEach(job.play);
    const result = job.finish(),
      league = result.league!;
    const initial = createPlayoffs(league, run.seasonSeed);
    expect(initial.chemistryBonds).toEqual(league.chemistryBonds);
    const playoffs = simulatePlayoffs(league, run.seasonSeed);
    expect(
      replayPlayoffs(league, run.seasonSeed, playoffGameCount(playoffs)),
    ).toEqual(playoffs);
    const playoffGame = playoffs.series.flatMap((s) => s.games)[0];
    const match = resolvePlayoffMatch(playoffGame, teams);
    const archive = {
      replay: { teams, playedGames: {}, playoffs },
    } as unknown as FranchiseSeason;
    expect(resolveArchivedMatch(archive, playoffGame, "playoffs")).toEqual(
      match,
    );
    expect(match.homeScore).toBe(playoffGame.homeScore);
    expect(match.awayScore).toBe(playoffGame.awayScore);
    const home = playoffGame.homeTeamId;
    expect(
      Object.values(playoffs.chemistryBonds![home]).reduce((a, b) => a + b, 0),
    ).toBeGreaterThan(
      Object.values(league.chemistryBonds![home]).reduce((a, b) => a + b, 0),
    );
  });

  it("rejects inconsistent growth switches and invalid bank data", () => {
    const teams = createLeague(runFixture());
    const mixed = structuredClone(teams);
    delete mixed[1].chemistryGrowthVersion;
    expect(() => validateLeagueTeams(mixed, true)).toThrow();
    const bad = structuredClone(teams);
    bad[0].chemistryBonds = { "65:1": 5 };
    expect(() => validateLeagueTeams(bad, true)).toThrow();
    const noChemistry = runFixture();
    delete noChemistry.chemistryVersion;
    expect(() => createLeague(noChemistry)).toThrow();
  });
});
