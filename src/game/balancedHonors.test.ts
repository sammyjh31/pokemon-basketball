import { expect, it } from "vitest";
import type { CourtVersion } from "./courtTypes";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { leagueHonors, leaguePlayers } from "./leagueStats";
import { createPlayoffs } from "./playoffs";
import type {
  LeagueGameSummary,
  LeaguePlayer,
  LeagueResult,
  Standing,
} from "./types";

const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const teams = (courtVersion: CourtVersion) =>
  createLeague({ ...createRun("free", false, 5150), roster }).map((t) => ({
    ...t,
    courtVersion,
  }));
const standing = (teamId: number, wins: number, diff = 0): Standing => ({
  teamId,
  wins,
  losses: 82 - wins,
  pointsFor: 9000 + diff,
  pointsAgainst: 9000,
  homeWins: 0,
  awayWins: 0,
  streak: 0,
  lastTen: 0,
});
const game = (
  homeTeamId: number,
  awayTeamId: number,
  homeWon: boolean,
): LeagueGameSummary => ({
  id: `g-${homeTeamId}-${awayTeamId}-${Number(homeWon)}`,
  round: 0,
  homeTeamId,
  awayTeamId,
  seed: 1,
  homeScore: homeWon ? 100 : 90,
  awayScore: homeWon ? 90 : 100,
  overtimePeriods: 0,
});
/** Clubs 0 and 7 tie on wins and point differential; everyone else has a distinct record. */
function league(
  courtVersion: CourtVersion,
  games: LeagueGameSummary[],
): LeagueResult {
  return {
    teams: teams(courtVersion),
    games,
    players: [],
    standings: Array.from({ length: 30 }, (_, id) =>
      id === 0 || id === 7
        ? standing(id, 60)
        : standing(id, id < 7 ? 70 - id : 59 - id),
    ),
    awards: [],
    allLeague: [],
    allDefense: [],
  };
}
const seedOf = (l: LeagueResult, seasonSeed: number, teamId: number) =>
  createPlayoffs(l, seasonSeed).seeds.find((s) => s.teamId === teamId)!.seed;

it("keeps team-ID seeding ties for version-2 seasons", () => {
  const l = league(2, [game(7, 0, true), game(0, 7, false)]);
  for (const seed of [1, 2, 3])
    expect(seedOf(l, seed, 0)).toBeLessThan(seedOf(l, seed, 7));
});

it("breaks version-3 seeding ties by head-to-head before anything else", () => {
  const l = league(3, [game(7, 0, true), game(0, 7, false), game(0, 7, true)]);
  for (const seed of [1, 2, 3, 4])
    expect(seedOf(l, seed, 7)).toBeLessThan(seedOf(l, seed, 0));
  // Point differential still decides when the season series is level.
  const level = league(3, [game(7, 0, true), game(0, 7, true)]);
  level.standings[0] = standing(0, 60, 40);
  expect(seedOf(level, 9, 0)).toBeLessThan(seedOf(level, 9, 7));
});

it("flips a seeded coin for exact version-3 ties instead of favouring club 0", () => {
  const l = league(3, [game(7, 0, true), game(0, 7, true)]);
  const userFirst = Array.from(
    { length: 40 },
    (_, seed) => seedOf(l, seed + 1, 0) < seedOf(l, seed + 1, 7),
  );
  expect(userFirst.filter(Boolean).length).toBeGreaterThan(8);
  expect(userFirst.filter((x) => !x).length).toBeGreaterThan(8);
  // Deterministic for a given season seed.
  expect(seedOf(l, 17, 0)).toBe(seedOf(l, 17, 0));
});

/** Two clubs' players with identical lines, plus a volume big and an efficient wing. */
function awardsPool() {
  const players = leaguePlayers(teams(3)),
    line = (p: LeaguePlayer, stats: Partial<LeaguePlayer>) =>
      Object.assign(
        p,
        { gamesPlayed: 82, gamesStarted: 82, minutes: 82 * 34 },
        stats,
      );
  for (const p of players)
    line(p, { points: 82 * 8, fga: 82 * 7, fgm: 82 * 3 });
  return players;
}
const flatStandings = () =>
  Array.from({ length: 30 }, (_, id) => standing(id, 41));

it("breaks version-3 award ties with a seeded coin flip", () => {
  const winners = (balanced: boolean) =>
    Array.from({ length: 30 }, (_, seed) => {
      const players = awardsPool();
      // Identical lines on club 0 and club 4.
      for (const p of [players[0], players[4 * 8]])
        Object.assign(p, { points: 82 * 30, fga: 82 * 20, fgm: 82 * 11 });
      return leagueHonors(
        players,
        flatStandings(),
        82,
        balanced ? { balanced: true, seed: seed + 1 } : undefined,
      ).awards.find((a) => a.id === "scoring")!.teamId;
    });
  expect(new Set(winners(false))).toEqual(new Set([0]));
  const balanced = winners(true);
  expect(balanced.filter((id) => id === 0).length).toBeGreaterThan(5);
  expect(balanced.filter((id) => id === 4).length).toBeGreaterThan(5);
});
