import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { playerProfile } from "./playerProfile";
import {
  attributes,
  bestPosition,
  positionRating,
  rotationMinutes,
  teamRatings,
} from "./ratings";
import { seasonTeams, simulateSeason } from "./season";
import {
  DEVELOPMENT_SKILLS,
  type DevelopmentRatings,
  type PlayerDevelopment,
} from "./developmentTypes";
import { POSITIONS, type LeagueTeam, type Roster } from "./types";

const roster: Roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const run = { ...createRun("free", false, 11), roster };
const mon = POKEMON_BY_ID.get(65)!;
const uniform = (amount: number): DevelopmentRatings =>
  Object.fromEntries(DEVELOPMENT_SKILLS.map((key) => [key, amount]));
const wholeTeam = (amount: number): PlayerDevelopment =>
  Object.fromEntries(Object.values(roster).map((id) => [id!, uniform(amount)]));
const team = (id: number, development?: PlayerDevelopment): LeagueTeam => ({
  id,
  name: `Team ${id}`,
  roster,
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  ratings: teamRatings(roster),
  ...(development ? { development } : {}),
});

// Guards the old save replay contract against altered arithmetic or RNG order.
it("preserves the exact legacy ratings, profiles, rotations and match replay", () => {
  const value = {
    attributes: POKEMON.map((p) => attributes(p)),
    profiles: POKEMON.map((p) => playerProfile(p)),
    rotations: rotationMinutes(roster),
    ratings: teamRatings(roster),
    match: simulateMatch(team(0), team(1), 12345),
  };
  expect(
    createHash("sha256").update(JSON.stringify(value)).digest("hex"),
  ).toMatchInlineSnapshot(
    `"a4f2f78132e8fa8f1990d7a5d8c867a91363b27a7cfe59aefe5ec5e30722d10e"`,
  );
});

describe("developed basketball skills", () => {
  it("applies primitive offsets once and recomputes the three summaries", () => {
    const base = attributes(mon);
    const developed = attributes(mon, {
      threePoint: 10,
      midRange: -10,
      freeThrow: 5,
      passing: 8,
      ballHandling: 4,
      composure: -6,
      offensiveRebound: 6,
      defensiveRebound: -2,
      speed: 10,
    });
    expect(developed.threePoint - base.threePoint).toBeCloseTo(10);
    expect(developed.shooting - base.shooting).toBeCloseTo(3);
    expect(developed.playmaking - base.playmaking).toBeCloseTo(4.5);
    expect(developed.rebounding - base.rebounding).toBeCloseTo(1.6);
    expect(developed.perimeterDefense).toBe(base.perimeterDefense);
    expect(developed.interiorDefense).toBe(base.interiorDefense);
    expect(
      attributes(mon, { perimeterDefense: 12 }).perimeterDefense -
        base.perimeterDefense,
    ).toBeCloseTo(12);
  });

  it("bounds cumulative offsets and final skill values without changing Pokémon facts", () => {
    const facts = structuredClone(mon);
    const high = attributes(mon, uniform(1000)),
      low = attributes(mon, uniform(-1000));
    const base = attributes(mon);
    for (const key of DEVELOPMENT_SKILLS) {
      expect(high[key]).toBe(Math.min(100, base[key] + 30));
      expect(low[key]).toBe(Math.max(0, base[key] - 30));
    }
    expect(mon).toEqual(facts);
  });

  it("keeps empty and explicitly zero offsets numerically identical to legacy inputs", () => {
    for (const p of POKEMON) {
      expect(attributes(p, uniform(0))).toEqual(attributes(p));
      expect(playerProfile(p, {})).toEqual(playerProfile(p));
      expect(bestPosition(p, uniform(0))).toBe(bestPosition(p));
      for (const position of POSITIONS)
        expect(positionRating(p, position, {})).toBe(
          positionRating(p, position),
        );
    }
    expect(rotationMinutes(roster, "balanced", wholeTeam(0))).toEqual(
      rotationMinutes(roster),
    );
    expect(teamRatings(roster, "balanced", "balanced", wholeTeam(0))).toEqual(
      teamRatings(roster),
    );
    expect(simulateMatch(team(0, wholeTeam(0)), team(1), 15)).toEqual(
      simulateMatch(team(0), team(1), 15),
    );
  });

  it("recomputes profiles when mutable offsets change and isolates legacy and historical profiles", () => {
    const legacy = playerProfile(mon),
      before = structuredClone(legacy);
    const offsets: DevelopmentRatings = {
      passing: -20,
      composure: -10,
      threePoint: -20,
    };
    const first = playerProfile(mon, offsets),
      frozen = structuredClone(first);
    offsets.passing = 20;
    offsets.composure = 10;
    offsets.threePoint = 20;
    const next = playerProfile(mon, offsets);
    expect(
      next.traits.decisionMaking - first.traits.decisionMaking,
    ).toBeGreaterThan(15);
    expect(next.positions.PG).toBeGreaterThan(first.positions.PG);
    expect(next.traits.offBall).toBeGreaterThan(first.traits.offBall);
    expect(first).toEqual(frozen);
    expect(playerProfile(mon)).toEqual(before);
  });

  it("rewards developed ability in team ratings, best positions and rotation allocation", () => {
    const development: PlayerDevelopment = {
      65: uniform(-30),
      121: uniform(30),
    };
    const minutes = rotationMinutes(roster, "balanced", development);
    expect(minutes.PG).toBeLessThan(rotationMinutes(roster).PG);
    expect(minutes.B1).toBeGreaterThan(rotationMinutes(roster).B1);
    expect(Object.values(minutes).reduce((a, b) => a + b, 0)).toBe(240);
    expect(
      teamRatings(roster, "balanced", "balanced", wholeTeam(30)).overall,
    ).toBeGreaterThan(teamRatings(roster).overall + 15);
    expect(
      bestPosition(mon, {
        passing: -30,
        ballHandling: -30,
        speed: -30,
        block: 30,
        interiorDefense: 30,
        offensiveRebound: 30,
        defensiveRebound: 30,
        strength: 30,
      }),
    ).not.toBe(bestPosition(mon));
  });

  it("changes actual match outcomes deterministically and invalidates cached rotation targets", () => {
    const home = team(0, wholeTeam(-30)),
      away = team(1);
    const slump = simulateMatch(home, away, 12345);
    home.development = wholeTeam(30);
    const breakout = simulateMatch(home, away, 12345);
    expect(breakout).toEqual(simulateMatch(structuredClone(home), away, 12345));
    expect(breakout).not.toEqual(slump);
    let boostedMargin = 0,
      slumpedMargin = 0;
    for (let seed = 10; seed < 30; seed++) {
      const high = simulateMatch(home, away, seed),
        low = simulateMatch(team(0, wholeTeam(-30)), away, seed);
      boostedMargin += high.homeScore - high.awayScore;
      slumpedMargin += low.homeScore - low.awayScore;
    }
    expect(boostedMargin - slumpedMargin).toBeGreaterThan(400);
    // Warm the cache with each configuration and verify revisiting a prior input.
    const differentMinutes = team(0, { 65: uniform(-30), 121: uniform(30) });
    const first = simulateMatch(differentMinutes, away, 987);
    differentMinutes.development![65] = uniform(30);
    differentMinutes.development![121] = uniform(-30);
    expect(
      simulateMatch(differentMinutes, away, 987).homeBox.map((p) => p.minutes),
    ).not.toEqual(first.homeBox.map((p) => p.minutes));
    expect(
      simulateMatch(team(0, { 65: uniform(-30), 121: uniform(30) }), away, 987),
    ).toEqual(first);
  });

  it("matches fresh rotation targets after offsets change on the same roster", async () => {
    const home = team(0, { 65: uniform(-30), 121: uniform(30) });
    const away = team(1);
    simulateMatch(home, away, 761);
    home.development![65] = uniform(30);
    home.development![121] = uniform(-30);
    const warmed = simulateMatch(home, away, 761);
    vi.resetModules();
    const fresh = await import("./match");
    expect(warmed).toEqual(fresh.simulateMatch(home, away, 761));
  });

  it("freezes developed season inputs, emits model 5, and replays stored games", () => {
    const teams = createLeague(run).map((t) => ({
      ...t,
      development: Object.fromEntries(
        Object.values(t.roster).map((id) => [
          id!,
          uniform(t.id === 0 ? 20 : -5),
        ]),
      ),
    }));
    const fixedRun = { ...run, leagueTeams: teams };
    const prepared = seasonTeams(fixedRun);
    expect(prepared[0].ratings.overall).toBeGreaterThan(
      teams[0].ratings.overall,
    );
    const result = simulateSeason(fixedRun),
      league = result.league!;
    expect(result.modelVersion).toBe(5);
    const stored = structuredClone(league.teams);
    teams[0].development[65].passing = -30;
    expect(league.teams).toEqual(stored);
    for (const game of league.games.slice(0, 5)) {
      const replay = simulateMatch(
        league.teams[game.homeTeamId],
        league.teams[game.awayTeamId],
        game.seed,
      );
      expect([
        replay.homeScore,
        replay.awayScore,
        replay.overtimePeriods,
      ]).toEqual([game.homeScore, game.awayScore, game.overtimePeriods]);
    }
    const userGame = result.games[0],
      fixture = league.games.find((g) => g.id === userGame.leagueGameId)!;
    const replay = simulateMatch(
      league.teams[fixture.homeTeamId],
      league.teams[fixture.awayTeamId],
      fixture.seed,
    );
    expect(userGame.boxScore).toEqual(
      userGame.home ? replay.homeBox : replay.awayBox,
    );
    expect(userGame.opponentBoxScore).toEqual(
      userGame.home ? replay.awayBox : replay.homeBox,
    );
  }, 90000); // Multiple full developed-season simulations and replay.
});
