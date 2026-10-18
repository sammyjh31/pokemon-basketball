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
import { evaluateLineupChemistry } from "./lineupChemistry";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { simulateMatch } from "./match";

describe("recorded insight calculations", () => {
  it("only replays the selected club's schedule and caches reports for each club independently", async () => {
    const league = insightLeague(4);
    league.teams.push({ ...league.teams[1], id: 2, name: "Third club" });
    league.games[1] = { ...league.games[1], homeTeamId: 1, awayTeamId: 2 };
    league.games[3] = { ...league.games[3], homeTeamId: 2, awayTeamId: 1 };
    const seen: string[] = [],
      progress: number[][] = [];
    const resolveMatch = (game: (typeof league.games)[number]) => {
      seen.push(game.id);
      return insightMatch();
    };
    const first = await buildSeasonInsights(league, {
      teamId: 0,
      resolveMatch,
      onProgress: (done, total) => progress.push([done, total]),
    });
    expect(seen).toEqual(["g0", "g2"]);
    expect(first.games).toBe(2);
    expect(first.players["0:1"].map((g) => g.gameId)).toEqual(["g0", "g2"]);
    expect(progress.at(-1)).toEqual([2, 2]);
    const other = await buildSeasonInsights(league, {
      teamId: 1,
      resolveMatch,
    });
    expect(other.games).toBe(4);
    const before = seen.length;
    expect(await buildSeasonInsights(league, { teamId: 0, resolveMatch })).toBe(
      first,
    );
    expect(seen).toHaveLength(before);
  });
  it("replays frozen mastery when no external resolver is supplied", async () => {
    const league = insightLeague();
    league.teams = league.teams.map((team) => ({
      ...team,
      abilityVersion: 1,
      abilityMasteryVersion: 1,
      abilityMastery: Object.fromEntries(
        Object.values(team.roster).map((id) => [id, 0]),
      ),
    }));
    const mastery = { home: Array(8).fill(700), away: Array(8).fill(400) };
    const match = simulateMatch(league.teams[0], league.teams[1], 712, {
      mastery,
    });
    league.games = [
      {
        ...league.games[0],
        seed: 712,
        mastery,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        overtimePeriods: match.overtimePeriods,
      },
    ];
    const data = await buildSeasonInsights(league);
    expect(data.detailGames).toBe(1);
    expect(data.unavailableGames).toBe(0);
    expect(data.players["0:1"][0].points).toBe(
      match.homeBox.find((p) => p.playerId === "0:1")!.points,
    );
    expect(
      data.defense.map((p) => p.expectedPointsAllowed).sort((a, b) => a - b),
    ).toEqual(
      match
        .insights!.defense.map((p) => p.expectedPointsAllowed)
        .sort((a, b) => a - b),
    );
  });
  it("replays a game with its frozen pregame chemistry instead of the season opening or final bank", async () => {
    const league = insightLeague();
    league.teams = league.teams.map((team) => ({
      ...team,
      abilityVersion: 1,
      chemistryVersion: 1,
      chemistryGrowthVersion: 1,
      chemistryBonds: {},
    }));
    const chemistry = { home: Array(28).fill(600), away: Array(28).fill(600) };
    const match = simulateMatch(league.teams[0], league.teams[1], 712, {
      chemistry,
    });
    league.games = [
      {
        ...league.games[0],
        seed: 712,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        overtimePeriods: match.overtimePeriods,
        chemistry,
      },
    ];
    league.chemistryBonds = { 0: { "1:2": 6000 }, 1: { "9:10": 6000 } };
    const data = await buildSeasonInsights(league);
    expect(data.detailGames).toBe(1);
    expect(data.unavailableGames).toBe(0);
    expect(data.lineups.length).toBeGreaterThan(0);
    expect(
      data.lineups.every((row) => row.chemistry?.continuity?.score === 50),
    ).toBe(true);
    expect(
      league.teams.every(
        (team) => Object.keys(team.chemistryBonds!).length === 0,
      ),
    ).toBe(true);
  });
  it("averages familiarity by actual lineup time without replacing historical games with the current bank", async () => {
    const players = [1, 2, 3, 4, 5].map((pokemonId) => ({
      pokemonId,
      profile: playerProfile(POKEMON_BY_ID.get(pokemonId)!),
    }));
    const fresh = evaluateLineupChemistry(players, {
      tactic: "balanced",
      defense: "man",
      abilities: false,
      bonds: {},
      morale: Object.fromEntries(players.map((p) => [p.pokemonId, 30])),
    });
    const experienced = evaluateLineupChemistry(players, {
      tactic: "balanced",
      defense: "man",
      abilities: false,
      bonds: { "1:2": 600 },
      morale: Object.fromEntries(players.map((p) => [p.pokemonId, 70])),
    });
    const matches = [fresh, experienced].map((chemistry, index) => {
      const match = insightMatch();
      match.insights!.lineups[0] = {
        ...match.insights!.lineups[0],
        chemistry,
        seconds: index ? 180 : 60,
      };
      return match;
    });
    const before = JSON.stringify(matches);
    const data = await buildSeasonInsights(
      { ...insightLeague(2), chemistryBonds: { 0: { "1:2": 6000 } } },
      { resolveMatch: (game) => matches[game.round] },
    );
    expect(data.lineups[0].chemistry?.continuity?.sharedMinutes).toBeCloseTo(
      45,
    );
    expect(data.lineups[0].chemistry?.continuity?.score).toBeCloseTo(3.75);
    expect(data.lineups[0].chemistry?.morale?.score).toBeCloseTo(60);
    expect(data.lineups[0].chemistry?.morale?.cohesionDelta).toBeCloseTo(0.8);
    expect(
      data.lineups[0].chemistry?.continuity?.pairs.find(
        (pair) => pair.pokemonIds.join(":") === "1:2",
      )?.minutes,
    ).toBeCloseTo(450);
    expect(JSON.stringify(matches)).toBe(before);
  });
  it("weights recorded captain influence by court time and keeps different captains separate", async () => {
    const chemistry = evaluateLineupChemistry(
      [1, 2, 3, 4, 5].map((pokemonId) => ({
        pokemonId,
        profile: playerProfile(POKEMON_BY_ID.get(pokemonId)!),
      })),
      { tactic: "balanced", defense: "man", abilities: false, bonds: {} },
    );
    const matches = [
      { captainId: 1, cohesionDelta: 0.5, seconds: 60 },
      { captainId: 1, cohesionDelta: 1.5, seconds: 180 },
      { captainId: 2, cohesionDelta: 2, seconds: 120 },
    ].map(({ captainId, cohesionDelta, seconds }) => {
      const match = insightMatch();
      match.insights!.lineups[0] = {
        ...match.insights!.lineups[0],
        seconds,
        chemistry: {
          ...chemistry,
          leadership: {
            captainId,
            style: "Organizer",
            active: true,
            cohesionDelta,
          },
        },
      };
      return match;
    });
    const before = JSON.stringify(matches);
    const data = await buildSeasonInsights(insightLeague(3), {
      resolveMatch: (game) => matches[game.round],
    });
    expect(data.lineups).toHaveLength(2);
    const first = data.lineups.find(
      (row) => row.chemistry?.leadership?.captainId === 1,
    )!;
    expect(first.seconds).toBe(240);
    expect(first.games).toBe(2);
    expect(first.chemistry?.leadership?.cohesionDelta).toBeCloseTo(1.25);
    expect(
      data.lineups.find((row) => row.chemistry?.leadership?.captainId === 2)
        ?.seconds,
    ).toBe(120);
    expect(JSON.stringify(matches)).toBe(before);
  });
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
