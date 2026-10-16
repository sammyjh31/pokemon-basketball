import { describe, expect, it } from "vitest";
import { emptyBox } from "./boxscore";
import {
  emptyScouting,
  recordScouting,
  scoutingForMatch,
  validateMatchScouting,
} from "./opponentScouting";
import type {
  MatchScouting,
  OpponentScouting,
  ScoutingMemory,
  TypeTacticsReport,
} from "./typeTacticsTypes";
import {
  ROSTER_SLOTS,
  type LeagueBox,
  type LeagueMatch,
  type LeagueTeam,
  type Roster,
} from "./types";

function team(id: number, firstPlayer: number): LeagueTeam {
  return {
    id,
    name: `Team ${id}`,
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((slot, i) => [slot, firstPlayer + i]),
    ) as Roster,
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
    ratings: {
      offense: 70,
      defense: 70,
      overall: 70,
      filled: 5,
      complete: true,
    },
  };
}
const home = team(10, 1),
  away = team(20, 11);

function boxes(team: LeagueTeam): LeagueBox[] {
  return ROSTER_SLOTS.map((slot) => ({
    ...emptyBox(team.roster[slot]!, slot),
    teamId: team.id,
    playerId: `${team.id}:${team.roster[slot]}`,
    started: !slot.startsWith("B"),
    fouls: 0,
    plusMinus: 0,
    rimFgm: 0,
    rimFga: 0,
    midFgm: 0,
    midFga: 0,
  }));
}

function completedMatch(): LeagueMatch & { typeTactics?: TypeTacticsReport } {
  const homeBox = boxes(home),
    awayBox = boxes(away);
  Object.assign(homeBox[0], {
    fga: 10,
    fgm: 6,
    threePA: 4,
    threePM: 2,
    rimFga: 4,
    rimFgm: 3,
    midFga: 2,
    midFgm: 1,
    points: 21,
    ftm: 7,
    fta: 8,
  });
  Object.assign(awayBox[0], {
    fga: 20,
    fgm: 8,
    threePA: 8,
    threePM: 3,
    rimFga: 9,
    rimFgm: 4,
    midFga: 3,
    midFgm: 1,
    points: 23,
    ftm: 4,
    fta: 4,
  });
  const summary = {
    priorMeetings: 0,
    crossMatches: 0,
    screens: 0,
    switches: 0,
    stays: 0,
    rolls: 0,
    helpRotations: 0,
    kickouts: 0,
    notes: [],
  };
  return {
    homeScore: 21,
    awayScore: 23,
    homeBox,
    awayBox,
    overtimePeriods: 0,
    possessions: 75,
    periods: [
      { home: 5, away: 6 },
      { home: 6, away: 7 },
      { home: 4, away: 5 },
      { home: 6, away: 5 },
    ],
    leadChanges: 0,
    largestLead: { home: 0, away: 2 },
    plays: {
      transition: { home: 0, away: 0 },
      pickRoll: { home: 12, away: 18 },
      isolation: { home: 0, away: 0 },
      post: { home: 0, away: 0 },
      spotUp: { home: 0, away: 0 },
    },
    playerOfGameId: "20:11",
    typeTactics: {
      home: { ...summary, switches: 3, helpRotations: 5 },
      away: { ...summary, switches: 7, helpRotations: 11 },
    },
  };
}

function observed(): MatchScouting {
  const memory: ScoutingMemory = {};
  recordScouting(memory, home, away, completedMatch());
  return scoutingForMatch(memory, home.id, away.id);
}

describe("opponent scouting memory", () => {
  it("starts with independent empty histories and does not write on lookup", () => {
    const memory: ScoutingMemory = {};
    const before = scoutingForMatch(memory, home.id, away.id);
    expect(before).toEqual({
      home: {
        games: 0,
        possessions: 0,
        pickRolls: 0,
        switches: 0,
        helpRotations: 0,
        players: {},
      },
      away: {
        games: 0,
        possessions: 0,
        pickRolls: 0,
        switches: 0,
        helpRotations: 0,
        players: {},
      },
    });
    before.home.players[11] = {
      attempts: 3,
      points: 2,
      rimAttempts: 1,
      threeAttempts: 2,
    };
    expect(before.away.players).toEqual({});
    expect(emptyScouting().players).toEqual({});
    expect(memory).toEqual({});
  });

  it("records the opponent's offense and defensive choices in each observer's view", () => {
    const memory: ScoutingMemory = {};
    recordScouting(memory, home, away, completedMatch());
    expect(Object.keys(memory).sort()).toEqual(["10:20", "20:10"]);
    expect(memory["10:20"]).toMatchObject({
      games: 1,
      possessions: 75,
      pickRolls: 18,
      switches: 7,
      helpRotations: 11,
      players: {
        11: { attempts: 20, points: 19, rimAttempts: 9, threeAttempts: 8 },
      },
    });
    expect(memory["20:10"]).toMatchObject({
      games: 1,
      possessions: 75,
      pickRolls: 12,
      switches: 3,
      helpRotations: 5,
      players: {
        1: { attempts: 10, points: 14, rimAttempts: 4, threeAttempts: 4 },
      },
    });
    expect(memory["10:20"].players[1]).toBeUndefined();
    expect(
      scoutingForMatch(memory, away.id, home.id).home.players[1].points,
    ).toBe(14);
  });

  it("learns official box observations without inventing unreported tactical events", () => {
    const memory: ScoutingMemory = {},
      match = completedMatch();
    delete match.typeTactics;
    match.plays.pickRoll = { home: 0, away: 0 };
    recordScouting(memory, home, away, match);
    expect(memory["10:20"]).toMatchObject({
      games: 1,
      pickRolls: 0,
      switches: 0,
      helpRotations: 0,
      players: { 11: { attempts: 20, points: 19 } },
    });
  });

  it("discounts previous observations while keeping games cumulative and unrelated opponents intact", () => {
    const untouched: OpponentScouting = {
      games: 1,
      possessions: 40,
      pickRolls: 6,
      switches: 2,
      helpRotations: 3,
      players: {
        99: { attempts: 10, points: 8, rimAttempts: 3, threeAttempts: 4 },
      },
    };
    const memory: ScoutingMemory = { "10:30": untouched };
    recordScouting(memory, home, away, completedMatch());
    const recent = completedMatch();
    recent.possessions = 50;
    recent.plays.pickRoll.away = 8;
    recent.typeTactics!.away.switches = 1;
    recent.typeTactics!.away.helpRotations = 4;
    Object.assign(recent.awayBox[0], {
      fga: 4,
      fgm: 1,
      rimFga: 1,
      rimFgm: 1,
      threePA: 0,
      threePM: 0,
      midFga: 3,
      midFgm: 0,
      points: 2,
      ftm: 0,
      fta: 0,
    });
    recordScouting(memory, home, away, recent);
    expect(memory["10:20"]).toMatchObject({
      games: 2,
      possessions: 98.75,
      pickRolls: expect.closeTo(19.7),
      switches: expect.closeTo(5.55),
      helpRotations: expect.closeTo(11.15),
      players: {
        11: {
          attempts: 17,
          points: expect.closeTo(14.35),
          rimAttempts: expect.closeTo(6.85),
          threeAttempts: expect.closeTo(5.2),
        },
      },
    });
    expect(memory["10:30"]).toBe(untouched);
    expect(untouched.players[99].attempts).toBe(10);
  });

  it("discards departed players and does not transfer another opponent's history", () => {
    const memory: ScoutingMemory = {};
    recordScouting(memory, home, away, completedMatch());
    const changedAway = structuredClone(away),
      match = completedMatch();
    changedAway.roster.PG = 99;
    Object.assign(match.awayBox[0], { pokemonId: 99, playerId: "20:99" });
    recordScouting(memory, home, changedAway, match);
    expect(memory["10:20"].players[11]).toBeUndefined();
    expect(memory["10:20"].players[99]).toEqual({
      attempts: 20,
      points: 19,
      rimAttempts: 9,
      threeAttempts: 8,
    });
    expect(scoutingForMatch(memory, home.id, 30).home.games).toBe(0);
  });

  it("keeps pregame snapshots free of later results and never mutates input teams or matches", () => {
    const memory: ScoutingMemory = {},
      match = completedMatch();
    const inputs = structuredClone({ home, away, match });
    const firstPregame = scoutingForMatch(memory, home.id, away.id);
    recordScouting(memory, home, away, match);
    const secondPregame = scoutingForMatch(memory, home.id, away.id);
    const firstEntry = memory["10:20"];
    recordScouting(memory, home, away, match);
    expect(firstPregame.home.games).toBe(0);
    expect(secondPregame.home.games).toBe(1);
    expect(secondPregame.home.players[11].attempts).toBe(20);
    expect(firstEntry.players[11].attempts).toBe(20);
    secondPregame.home.players[11].attempts = 0;
    expect(memory["10:20"].players[11].attempts).toBe(33);
    expect({ home, away, match }).toEqual(inputs);
  });
});

describe("scouting context validation", () => {
  it("accepts empty and fractional discounted contexts, returning independent snapshots", () => {
    expect(
      validateMatchScouting(
        { home: emptyScouting(), away: emptyScouting() },
        home,
        away,
      ).home.games,
    ).toBe(0);
    const input = observed();
    input.home.players[11] = {
      attempts: 0.65,
      points: 1.3,
      rimAttempts: 0.65,
      threeAttempts: 0,
    };
    input.home.pickRolls = 0.65;
    const validated = validateMatchScouting(input, home, away);
    expect(validated).toEqual(input);
    validated.home.players[11].points = 0;
    expect(input.home.players[11].points).toBe(1.3);
  });

  const mutations: [string, (context: MatchScouting) => unknown][] = [
    ["missing side", (c) => ({ home: c.home })],
    ["unknown top-level field", (c) => ({ ...c, future: true })],
    ["unknown history field", (c) => ({ ...c, home: { ...c.home, wins: 3 } })],
    [
      "unknown player field",
      (c) => {
        Object.assign(c.home.players[11], { wins: 1 });
        return c;
      },
    ],
    ["non-object", () => null],
    ["array history", (c) => ({ ...c, home: [] })],
    ["array players", (c) => ({ ...c, home: { ...c.home, players: [] } })],
    [
      "wrong opponent roster",
      (c) => {
        c.home.players[1] = c.home.players[11];
        delete c.home.players[11];
        return c;
      },
    ],
    [
      "oversized roster",
      (c) => {
        c.home.players[99] = c.home.players[11];
        return c;
      },
    ],
    [
      "hidden out-of-roster player",
      (c) => {
        Object.defineProperty(c.home.players, "99", {
          value: c.home.players[11],
        });
        return c;
      },
    ],
    [
      "noncanonical player key",
      (c) => {
        Object.assign(c.home.players, { "011": c.home.players[11] });
        delete c.home.players[11];
        return c;
      },
    ],
    [
      "fractional games",
      (c) => {
        c.home.games = 1.5;
        return c;
      },
    ],
    [
      "too many games",
      (c) => {
        c.home.games = 1001;
        return c;
      },
    ],
    [
      "negative games",
      (c) => {
        c.home.games = -1;
        return c;
      },
    ],
    [
      "zero-game observations",
      (c) => {
        c.home.games = 0;
        return c;
      },
    ],
    [
      "nonfinite count",
      (c) => {
        c.home.pickRolls = Infinity;
        return c;
      },
    ],
    [
      "nan count",
      (c) => {
        c.home.possessions = NaN;
        return c;
      },
    ],
    [
      "negative count",
      (c) => {
        c.home.switches = -1;
        return c;
      },
    ],
    [
      "oversized count",
      (c) => {
        c.home.helpRotations = 1_000_001;
        return c;
      },
    ],
    ["string count", (c) => ({ ...c, home: { ...c.home, possessions: "75" } })],
    [
      "missing count",
      (c) => {
        Reflect.deleteProperty(c.home, "switches");
        return c;
      },
    ],
    [
      "nan player count",
      (c) => {
        c.home.players[11].attempts = NaN;
        return c;
      },
    ],
    [
      "negative player count",
      (c) => {
        c.home.players[11].rimAttempts = -0.1;
        return c;
      },
    ],
    [
      "oversized player count",
      (c) => {
        c.home.players[11].points = 1_000_001;
        return c;
      },
    ],
    [
      "impossible scoring",
      (c) => {
        c.home.players[11].points = 61;
        return c;
      },
    ],
    [
      "overlapping zone attempts",
      (c) => {
        c.home.players[11].threeAttempts = 12;
        return c;
      },
    ],
  ];
  it.each(mutations)("rejects %s", (_name, mutate) => {
    const invalid = mutate(observed());
    expect(() => validateMatchScouting(invalid, home, away)).toThrow();
  });
});
