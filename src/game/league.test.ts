import { beforeAll, describe, it, expect } from "vitest";
import { createRun } from "./draft";
import { simulateSeason, simulateSeasonAsync } from "./season";
import { createLeague, leagueSchedule } from "./league";
import { simulateMatch } from "./match";
import { leagueHonors } from "./leagueStats";
import { POKEMON_BY_ID } from "../data/pokemon";
import type { SeasonResult } from "./types";
const run = {
  ...createRun("free", false, 11),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
};
let result: SeasonResult;
beforeAll(() => {
  result = simulateSeason(run);
}, 60000);
describe("one shared league", () => {
  it("drafts 240 unique players across thirty eight-player clubs", () => {
    const teams = createLeague(run),
      ids = teams.flatMap((t) => Object.values(t.roster));
    expect(teams).toHaveLength(30);
    expect(ids).toHaveLength(240);
    expect(new Set(ids).size).toBe(240);
    expect(teams[0].roster).toEqual(run.roster);
    expect(ids.every((id) => !POKEMON_BY_ID.get(id!)!.legendary)).toBe(true);
    expect(teams).toEqual(createLeague(run));
    expect(createLeague({ ...run, seasonSeed: 56 })).not.toEqual(teams);
  });
  it("schedules 82 rounds, 41 home games each and every opponent at least twice", () => {
    const schedule = leagueSchedule(run.seasonSeed);
    expect(schedule).toHaveLength(1230);
    expect(new Set(schedule.map((g) => g.id)).size).toBe(1230);
    for (let team = 0; team < 30; team++) {
      const games = schedule.filter(
        (g) => g.homeTeamId === team || g.awayTeamId === team,
      );
      expect(games).toHaveLength(82);
      expect(games.filter((g) => g.homeTeamId === team)).toHaveLength(41);
      expect(new Set(games.map((g) => g.round)).size).toBe(82);
      for (let opponent = 0; opponent < 30; opponent++)
        if (opponent !== team)
          expect(
            games.filter(
              (g) => g.homeTeamId === opponent || g.awayTeamId === opponent,
            ).length,
          ).toBeGreaterThanOrEqual(2);
    }
  });
  it("derives every standing and all player totals from the same shared games", () => {
    expect(result.modelVersion).toBe(3);
    const league = result.league!;
    expect(league.players).toHaveLength(240);
    expect(league.games).toHaveLength(1230);
    expect(league.standings.reduce((s, t) => s + t.wins, 0)).toBe(1230);
    expect(league.standings.reduce((s, t) => s + t.losses, 0)).toBe(1230);
    for (const team of league.teams) {
      const standing = league.standings.find((s) => s.teamId === team.id)!,
        players = league.players.filter((p) => p.teamId === team.id),
        games = league.games.filter(
          (g) => g.homeTeamId === team.id || g.awayTeamId === team.id,
        );
      expect(standing.wins + standing.losses).toBe(82);
      expect(players.reduce((s, p) => s + p.points, 0)).toBe(
        standing.pointsFor,
      );
      // Continuous court minutes can accumulate binary floating-point noise.
      expect(players.reduce((s, p) => s + p.minutes, 0)).toBeCloseTo(
        82 * 240 + 25 * games.reduce((s, g) => s + g.overtimePeriods, 0),
        7,
      );
      expect(standing.pointsFor).toBe(
        games.reduce(
          (s, g) => s + (g.homeTeamId === team.id ? g.homeScore : g.awayScore),
          0,
        ),
      );
      expect(players.every((p) => p.gamesPlayed === 82)).toBe(true);
    }
    expect(result.playerStats).toHaveLength(8);
    expect(result.wins).toBe(league.standings[0].wins);
  });
  it("awards the entire league with qualified finalists and bench eligibility", () => {
    const league = result.league!,
      honors = leagueHonors(league.players, league.standings);
    expect(honors.awards).toEqual(league.awards);
    expect(league.awards).toHaveLength(6);
    for (const award of league.awards) {
      expect(award.finalists).toHaveLength(3);
      expect(award.playerId).toBe(award.finalists[0].playerId);
      expect(
        league.players.find((p) => p.playerId === award.playerId)?.gamesPlayed,
      ).toBeGreaterThanOrEqual(58);
    }
    const sixth = league.players.find(
      (p) =>
        p.playerId === league.awards.find((a) => a.id === "sixth")!.playerId,
    )!;
    expect(sixth.gamesStarted).toBeLessThan(sixth.gamesPlayed / 2);
    expect(new Set(league.allLeague).size).toBe(5);
    expect(new Set(league.allDefense).size).toBe(5);
    // An opponent with overwhelming production must beat the user's team.
    const boosted = league.players.map((p) =>
      p.teamId === 1 ? { ...p, points: 10000, assists: 3000 } : p,
    );
    expect(
      leagueHonors(boosted, league.standings).awards.find(
        (a) => a.id === "mvp",
      )!.teamId,
    ).toBe(1);
  });
  it("replays arbitrary opponents exactly and keeps the save under 3 MiB", () => {
    const league = result.league!,
      game = league.games.find(
        (g) => g.homeTeamId !== 0 && g.awayTeamId !== 0,
      )!;
    const match = simulateMatch(
      league.teams[game.homeTeamId],
      league.teams[game.awayTeamId],
      game.seed,
    );
    expect(match.homeScore).toBe(game.homeScore);
    expect(match.awayScore).toBe(game.awayScore);
    expect(match.overtimePeriods).toBe(game.overtimePeriods);
    expect(
      new TextEncoder().encode(JSON.stringify(result)).length,
    ).toBeLessThan(3 * 1024 * 1024);
  });
  it("produces the same results asynchronously and reports all 1230 games", async () => {
    const progress: number[] = [];
    const asyncResult = await simulateSeasonAsync(run, (n) => progress.push(n));
    expect(asyncResult).toEqual(result);
    expect(progress[0]).toBe(0);
    expect(progress.at(-1)).toBe(1230);
  }, 60000);
});
