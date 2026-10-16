import { describe, expect, it } from "vitest";
import {
  buildSeasonInsights,
  gameDrivers,
  lineupMetrics,
  playerTrendSummary,
  shotSummary,
} from "./insightAnalysis";
import {
  insightBox,
  insightLeague,
  insightMatch,
  insightShot,
} from "./insightAnalysis.testUtils";

describe("recorded insight calculations", () => {
  it("separates official attempts from shooting-foul events and includes their expectation", () => {
    expect(shotSummary(insightMatch().insights!.shots)).toMatchObject({
      events: 3,
      attempts: 2,
      made: 1,
      points: 2,
      expectedPoints: 2.15,
      fieldGoalPercent: 50,
    });
    expect(shotSummary([])).toMatchObject({
      attempts: 0,
      fieldGoalPercent: null,
      expectedPoints: 0,
    });
  });
  it("uses offensive starts and actual time for five-player lineup rates", () => {
    expect(lineupMetrics(insightMatch().insights!.lineups[0])).toEqual({
      minutes: 10,
      plusMinus: 2,
      pointsPer100: 160,
    });
    expect(
      lineupMetrics({ ...insightMatch().insights!.lineups[0], possessions: 0 }),
    ).toMatchObject({ pointsPer100: null });
  });
  it("compares recorded box events without attributing causation or synthesizing missing shots", () => {
    const drivers = gameDrivers(insightMatch());
    expect(drivers.turnovers).toEqual({ home: 2, away: 4 });
    expect(drivers.offensiveRebounds).toEqual({ home: 1, away: 0 });
    expect(drivers.freeThrows).toEqual({ home: 2, away: 1 });
    expect(drivers.shooting?.home.expectedPoints).toBeCloseTo(2.15);
    expect(
      gameDrivers(insightMatch({ insights: undefined })).shooting,
    ).toBeNull();
  });
  it("aggregates actual five-player combinations and defense with explicit samples", async () => {
    const league = insightLeague(2);
    const data = await buildSeasonInsights(league, {
      resolveMatch: () => insightMatch(),
    });
    expect(data).toMatchObject({
      games: 2,
      detailGames: 2,
      unavailableGames: 0,
      missingTelemetryGames: 0,
    });
    expect(data.lineups).toHaveLength(1);
    expect(data.lineups[0]).toMatchObject({
      games: 2,
      seconds: 1200,
      possessions: 10,
      pointsFor: 16,
      pointsAgainst: 12,
    });
    expect(data.defense[0]).toMatchObject({
      games: 2,
      matchups: 6,
      attempts: 4,
      pointsAllowed: 4,
      expectedPointsAllowed: 4.3,
    });
    expect(data.players["0:1"]).toHaveLength(2);
    expect(data).not.toHaveProperty("matches");
  });
  it("keeps official boxes without inventing their missing telemetry and skips mismatched replays", async () => {
    const data = await buildSeasonInsights(insightLeague(2), {
      resolveMatch: (game) =>
        insightMatch({ homeScore: game.round ? 999 : 10, insights: undefined }),
    });
    expect(data).toMatchObject({
      detailGames: 0,
      missingTelemetryGames: 1,
      unavailableGames: 1,
    });
    expect(data.players["0:1"].map((row) => row.status)).toEqual([
      "played",
      "unavailable",
    ]);
    expect(data.lineups).toEqual([]);
    expect(data.defense).toEqual([]);
  });
  it("averages the last team-game windows excluding DNPs and distinguishes unavailable samples", async () => {
    const data = await buildSeasonInsights(insightLeague(6), {
      resolveMatch: (game) =>
        insightMatch({
          homeBox: [
            insightBox({
              points: game.round * 2,
              minutes: game.round === 5 ? 0 : 20,
            }),
          ],
        }),
    });
    expect(playerTrendSummary(data.players["0:1"], 5)).toEqual({
      games: 4,
      scheduled: 5,
      points: 5,
      rebounds: 3,
      assists: 3,
      minutes: 20,
    });
    expect(playerTrendSummary([], 10)).toEqual({
      games: 0,
      scheduled: 0,
      points: null,
      rebounds: null,
      assists: null,
      minutes: null,
    });
    expect(playerTrendSummary(data.players["0:1"], 0).games).toBe(0);
  });
  it("reports progress and stops replay between fixtures when cancelled", async () => {
    const abort = new AbortController();
    const seen: number[] = [];
    await expect(
      buildSeasonInsights(insightLeague(5), {
        signal: abort.signal,
        resolveMatch: () => insightMatch(),
        onProgress: (done) => {
          seen.push(done);
          if (done === 1) abort.abort();
        },
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(seen).toEqual([0, 1]);
  });
  it("caches compact results in memory but respects a different authoritative resolver", async () => {
    const league = insightLeague();
    const resolveMatch = () => insightMatch();
    const first = await buildSeasonInsights(league, { resolveMatch });
    expect(await buildSeasonInsights(league, { resolveMatch })).toBe(first);
    const official = await buildSeasonInsights(league, {
      resolveMatch: () => insightMatch({ insights: undefined }),
    });
    expect(official.detailGames).toBe(0);
  });
  it("filters actual shooter samples without assuming roster-slot identity", () => {
    const shots = [
      insightShot(),
      insightShot({ shooterId: "0:2", made: false }),
    ];
    expect(
      shotSummary(shots.filter((shot) => shot.shooterId === "0:2")),
    ).toMatchObject({ attempts: 1, made: 0, points: 0 });
  });
});
