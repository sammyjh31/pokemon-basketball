import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { COUNTING_KEYS, leaguePlayers } from "./leagueStats";
import { simulateMatch } from "./match";
import type { LeagueResult } from "./types";
import {
  createPlayoffs,
  playoffGameCount,
  replayPlayoffs,
  simulatePlayoffs,
  simulatePlayoffsAsync,
  selectFinalsMvp,
} from "./playoffs";

const run = {
  ...createRun("free", false, 19),
  roster: { PG: 65, SG: 135, SF: 6, PF: 68, C: 143, B1: 121, B2: 149, B3: 131 },
};
const teams = createLeague(run);
const league: LeagueResult = {
  teams,
  games: [],
  players: [],
  awards: [],
  allLeague: [],
  allDefense: [],
  standings: teams.map((t) => ({
    teamId: t.id,
    wins: 60 - t.id,
    losses: 22 + t.id,
    pointsFor: 9000,
    pointsAgainst: 8500,
    homeWins: 30,
    awayWins: 30 - t.id,
    streak: 1,
    lastTen: 5,
  })),
};
const seed = run.seasonSeed;

describe("best-of-seven postseason", () => {
  it("breaks mathematically tied Finals impact by Pokemon ID despite floating rounding", () => {
    const [a, b] = leaguePlayers([teams[0]]);
    Object.assign(a, {
      gamesPlayed: 6,
      points: 102,
      defensiveRebounds: 32,
      assists: 30,
      steals: 3,
      blocks: 6,
      turnovers: 8,
      fgm: 40,
      fga: 82,
      ftm: 22,
      fta: 32,
    });
    Object.assign(b, {
      gamesPlayed: 6,
      points: 144,
      defensiveRebounds: 34,
      assists: 10,
      steals: 5,
      blocks: 0,
      turnovers: 16,
      fgm: 60,
      fga: 84,
      ftm: 24,
      fta: 28,
    });
    const losingStar = {
      ...a,
      teamId: 1,
      playerId: "1:1",
      pokemonId: 1,
      points: 999,
    };
    // Both championship candidates have exactly 179.6 impact; 65 wins over 135.
    expect(selectFinalsMvp([b, losingStar, a], 0)?.pokemonId).toBe(65);
    expect(selectFinalsMvp([b, losingStar, a], 0)?.value).toBe(
      "17.0 PPG · 5.3 RPG · 5.0 APG",
    );
  });
  it("qualifies sixteen teams and creates a fixed bracket with future opponents unknown", () => {
    const p = createPlayoffs(league, seed);
    expect(p.seeds.map((s) => s.teamId)).toEqual(
      Array.from({ length: 16 }, (_, i) => i),
    );
    expect(p.series).toHaveLength(15);
    expect(
      p.series
        .filter((s) => s.round === 0)
        .map((s) => [s.higherSeedId, s.lowerSeedId]),
    ).toEqual([
      [0, 15],
      [7, 8],
      [3, 12],
      [4, 11],
      [1, 14],
      [6, 9],
      [2, 13],
      [5, 10],
    ]);
    expect(
      p.series
        .filter((s) => s.round > 0)
        .every((s) => s.higherSeedId === null && s.lowerSeedId === null),
    ).toBe(true);
    expect(p.players).toHaveLength(128);
    expect(p.players.every((p) => p.points === 0 && p.gamesPlayed === 0)).toBe(
      true,
    );
    expect(p.championId).toBeNull();
    expect(p.finalsMvp).toBeNull();
  });
  it("breaks a qualification tie by differential and then stable team ID", () => {
    const tied = structuredClone(league);
    for (const id of [14, 15, 16])
      Object.assign(tied.standings[id], { wins: 45, losses: 37 });
    tied.standings[16].pointsFor = 9100;
    const qualified = createPlayoffs(tied, seed).seeds.map((s) => s.teamId);
    expect(qualified.slice(14)).toEqual([16, 14]);
    expect(qualified).not.toContain(15);
  });
  it("refuses to seed an incomplete regular season", () => {
    const incomplete = structuredClone(league);
    incomplete.standings[0].wins--;
    expect(() => createPlayoffs(incomplete, seed)).toThrow(/regular season/i);
  });
  it("plays one game per active series and does not mutate the prior bracket or regular season", () => {
    const p = createPlayoffs(league, seed),
      before = JSON.stringify(league);
    const next = simulatePlayoffs(league, seed, p, "game");
    expect(playoffGameCount(next)).toBe(8);
    expect(
      next.series
        .slice(0, 8)
        .every((s) => s.games.length === 1 && s.winnerId === null),
    ).toBe(true);
    expect(playoffGameCount(p)).toBe(0);
    expect(JSON.stringify(league)).toBe(before);
  });
  it("ends series at four wins, hosts 2–2–1–1–1, and advances adjacent winners without reseeding", () => {
    const p = simulatePlayoffs(league, seed, undefined, "all");
    expect(p.series.map((s) => s.round)).toEqual([
      ...Array(8).fill(0),
      ...Array(4).fill(1),
      2,
      2,
      3,
    ]);
    const homePattern = [true, true, false, false, true, false, true];
    for (const s of p.series) {
      expect(s.games.length).toBeGreaterThanOrEqual(4);
      expect(s.games.length).toBeLessThanOrEqual(7);
      expect(Math.max(s.higherSeedWins, s.lowerSeedWins)).toBe(4);
      expect(Math.min(s.higherSeedWins, s.lowerSeedWins)).toBeLessThan(4);
      const wins = new Map([
        [s.higherSeedId, 0],
        [s.lowerSeedId, 0],
      ]);
      s.games.forEach((g, i) => {
        expect(g.homeTeamId).toBe(
          homePattern[i] ? s.higherSeedId : s.lowerSeedId,
        );
        const winner = g.homeScore > g.awayScore ? g.homeTeamId : g.awayTeamId;
        wins.set(winner, wins.get(winner)! + 1);
        if (i < s.games.length - 1)
          expect(Math.max(...wins.values())).toBeLessThan(4);
      });
      expect(wins.get(s.winnerId)).toBe(4);
      if (s.round > 0) {
        const feeders = p.series
          .filter((x) => x.round === s.round - 1)
          .slice(s.index * 2, s.index * 2 + 2);
        expect(new Set([s.higherSeedId, s.lowerSeedId])).toEqual(
          new Set(feeders.map((x) => x.winnerId)),
        );
        expect(
          p.seeds.find((x) => x.teamId === s.higherSeedId)!.seed,
        ).toBeLessThan(p.seeds.find((x) => x.teamId === s.lowerSeedId)!.seed);
      }
    }
    expect(p.championId).toBe(p.series[14].winnerId);
  });
  it("reaches the same champion and stats by slates, rounds, all-at-once and partial replay", () => {
    const all = simulatePlayoffs(league, seed);
    let rounds = createPlayoffs(league, seed),
      slates = createPlayoffs(league, seed);
    for (let round = 0; round < 4; round++) {
      rounds = simulatePlayoffs(league, seed, rounds, "round");
      expect(
        rounds.series
          .filter((s) => s.round === round)
          .every((s) => s.winnerId !== null),
      ).toBe(true);
      expect(
        rounds.series
          .filter((s) => s.round > round)
          .every((s) => s.games.length === 0),
      ).toBe(true);
    }
    for (let i = 0; i < 28 && slates.championId === null; i++)
      slates = simulatePlayoffs(league, seed, slates, "game");
    expect(rounds).toEqual(all);
    expect(slates).toEqual(all);
    expect(replayPlayoffs(league, seed, 8)).toEqual(
      simulatePlayoffs(league, seed, undefined, "game"),
    );
    expect(replayPlayoffs(league, seed, playoffGameCount(all))).toEqual(all);
    expect(() => replayPlayoffs(league, seed, 106)).toThrow();
    expect(() =>
      replayPlayoffs(league, seed, playoffGameCount(all) + 1),
    ).toThrow();
    expect(simulatePlayoffs(league, seed, all)).toEqual(all);
  });
  it("derives playoff and Finals statistics from replayable game boxes and awards Finals-only impact", () => {
    const p = simulatePlayoffs(league, seed);
    const sums = new Map(
      p.players.map((player) => [
        player.playerId,
        Object.fromEntries(COUNTING_KEYS.map((k) => [k, 0])),
      ]),
    );
    const finalsSums = new Map<
      string,
      { points: number; impact: number; games: number }
    >();
    for (const s of p.series)
      for (const game of s.games) {
        const match = simulateMatch(
          teams.find((t) => t.id === game.homeTeamId)!,
          teams.find((t) => t.id === game.awayTeamId)!,
          game.seed,
          {
            scouting: game.scouting,
            chemistry: game.chemistry,
            morale: game.morale,
          },
        );
        expect([match.homeScore, match.awayScore]).toEqual([
          game.homeScore,
          game.awayScore,
        ]);
        for (const box of [...match.homeBox, ...match.awayBox]) {
          for (const key of COUNTING_KEYS)
            sums.get(box.playerId)![key] += box[key];
          if (s.round === 3) {
            const row = finalsSums.get(box.playerId) ?? {
              points: 0,
              impact: 0,
              games: 0,
            };
            row.points += box.points;
            row.games += Number(box.minutes > 0);
            row.impact +=
              box.points +
              1.2 * (box.offensiveRebounds + box.defensiveRebounds) +
              1.5 * box.assists +
              3 * box.steals +
              3 * box.blocks -
              1.5 * box.turnovers -
              0.4 * (box.fga - box.fgm) -
              0.4 * (box.fta - box.ftm);
            finalsSums.set(box.playerId, row);
          }
        }
      }
    for (const player of p.players)
      for (const key of COUNTING_KEYS)
        expect(player[key]).toBe(sums.get(player.playerId)![key]);
    expect(p.finalsPlayers).toHaveLength(16);
    for (const player of p.finalsPlayers)
      expect(player.points).toBe(finalsSums.get(player.playerId)!.points);
    const candidates = p.finalsPlayers
      .filter((x) => x.teamId === p.championId && x.gamesPlayed > 0)
      .sort(
        (a, b) =>
          finalsSums.get(b.playerId)!.impact -
            finalsSums.get(a.playerId)!.impact || a.pokemonId - b.pokemonId,
      );
    expect(p.finalsMvp!.playerId).toBe(candidates[0].playerId);
    expect(p.finalsMvp!.score).toBeCloseTo(
      finalsSums.get(candidates[0].playerId)!.impact,
      8,
    );
    expect(
      p.players.find((x) => x.playerId === p.finalsMvp!.playerId)!.points,
    ).toBeGreaterThan(candidates[0].points);
  });
  it("yields progress, matches synchronous output and cancels without mutating a saved bracket", async () => {
    const p = createPlayoffs(league, seed),
      progress: number[] = [];
    const result = await simulatePlayoffsAsync(
      league,
      seed,
      p,
      "round",
      (n, total) => {
        progress.push(n);
        expect(n).toBeLessThanOrEqual(total);
      },
    );
    expect(result).toEqual(simulatePlayoffs(league, seed, p, "round"));
    expect(progress.length).toBeGreaterThan(2);
    expect(progress.at(-1)).toBe(playoffGameCount(result));
    const controller = new AbortController();
    await expect(
      simulatePlayoffsAsync(
        league,
        seed,
        p,
        "all",
        (n) => {
          if (n === 1) controller.abort();
        },
        controller.signal,
      ),
    ).rejects.toThrow();
    expect(playoffGameCount(p)).toBe(0);
  });
});
