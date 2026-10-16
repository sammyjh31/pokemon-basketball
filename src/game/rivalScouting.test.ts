import { describe, expect, it } from "vitest";
import { simulateMatch } from "./match";
import { emptyScouting } from "./opponentScouting";
import { officialGameFromArcade } from "./officialGame";
import { finishedGame } from "./officialGame.testUtils";
import { captureRivalScouting, parseRivalScouting } from "./rivalScouting";
import type { Playoffs, PlayoffSeries } from "./playoffTypes";
import type { RivalScouting } from "./rivalScoutingTypes";
import type { OpponentScouting } from "./typeTacticsTypes";
import {
  ROSTER_SLOTS,
  type LeagueGameSummary,
  type LeagueResult,
  type LeagueTeam,
  type Roster,
} from "./types";

const teams: LeagueTeam[] = Array.from({ length: 6 }, (_, id) => ({
  id,
  name: `Team ${id}`,
  typeTacticsVersion: 1,
  typeMatchupsVersion: 1,
  roster: Object.fromEntries(
    ROSTER_SLOTS.map((slot, i) => [slot, id * 8 + i + 1]),
  ) as Roster,
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  ratings: { offense: 70, defense: 70, overall: 70, filled: 8, complete: true },
}));
const rosters = teams.map((team) => Object.values(team.roster) as number[]);
function game(
  homeTeamId: number,
  awayTeamId: number,
  homeScore = 100,
  awayScore = 90,
  id = "game",
): LeagueGameSummary {
  return {
    id,
    homeTeamId,
    awayTeamId,
    homeScore,
    awayScore,
    seed: 910,
    round: 1,
    overtimePeriods: 0,
  };
}
function observations(
  pokemonId: number,
  attempts = 20,
  points = 30,
): OpponentScouting {
  return {
    ...emptyScouting(),
    games: 3,
    players: {
      [pokemonId]: {
        attempts,
        points,
        rimAttempts: attempts / 2,
        threeAttempts: attempts / 4,
      },
    },
  };
}
function league(): LeagueResult {
  return {
    teams: structuredClone(teams),
    games: [],
    players: [],
    standings: [],
    awards: [],
    allLeague: [],
    allDefense: [],
    scouting: {},
  };
}
function playoffs(series: PlayoffSeries[] = []): Playoffs {
  return {
    modelVersion: 1,
    seeds: [],
    series,
    players: [],
    finalsPlayers: [],
    championId: 0,
    finalsMvp: null,
  };
}
function finalSeries(games: LeagueGameSummary[]): PlayoffSeries {
  return {
    id: "final",
    round: 3,
    index: 0,
    higherSeedId: 0,
    lowerSeedId: games[0].awayTeamId,
    higherSeedWins: games.length,
    lowerSeedWins: 0,
    winnerId: 0,
    games,
  };
}
function report(): RivalScouting {
  return {
    version: 1,
    teams: {
      0: [
        {
          teamId: 1,
          games: 4,
          losses: 2,
          playoffGames: 3,
          threats: [
            {
              pokemonId: 9,
              attempts: 20,
              points: 30,
              rimAttempts: 8,
              threeAttempts: 6,
            },
          ],
        },
      ],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
    },
  };
}

describe("completed-season rival scouting", () => {
  it("keeps opponent ownership and actual encounters separate from discounted observations", () => {
    const input = league();
    input.games = [game(0, 1), game(1, 0, 90, 80)];
    input.scouting = {
      "0:1": {
        ...observations(9, 10, 20),
        games: 999,
        players: {
          9: { attempts: 10, points: 20, rimAttempts: 4, threeAttempts: 3 },
          10: {
            attempts: 20,
            points: 18.00049,
            rimAttempts: 6.66666,
            threeAttempts: 5,
          },
          11: { attempts: 12, points: 19, rimAttempts: 4, threeAttempts: 4 },
          12: { attempts: 20, points: 17, rimAttempts: 5, threeAttempts: 5 },
          13: { attempts: 0, points: 0, rimAttempts: 0, threeAttempts: 0 },
        },
      },
      "1:0": observations(1, 6, 8),
    };
    const result = captureRivalScouting(input, playoffs())!;
    expect(result.teams[0]).toEqual([
      {
        teamId: 1,
        games: 2,
        losses: 1,
        playoffGames: 0,
        threats: [
          {
            pokemonId: 10,
            attempts: 20,
            points: 18,
            rimAttempts: 6.667,
            threeAttempts: 5,
          },
          {
            pokemonId: 9,
            attempts: 10,
            points: 20,
            rimAttempts: 4,
            threeAttempts: 3,
          },
          {
            pokemonId: 11,
            attempts: 12,
            points: 19,
            rimAttempts: 4,
            threeAttempts: 4,
          },
        ],
      },
    ]);
    expect(result.teams[1][0]).toMatchObject({
      teamId: 0,
      games: 2,
      losses: 1,
      threats: [{ pokemonId: 1, attempts: 6, points: 8 }],
    });
    expect(result.teams[2]).toEqual([]);
    expect(Object.keys(result.teams)).toHaveLength(6);
    expect(parseRivalScouting(result, rosters)).toEqual(result);
  });

  it("includes the final official playoff encounter using its frozen pregame observations", () => {
    const input = league();
    input.games = [game(0, 1, 80, 90)];
    input.scouting = {
      "0:1": observations(9, 2, 3),
      "1:0": observations(1, 2, 4),
    };
    const latest = game(0, 1, 96, 72, "last-final");
    latest.scouting = {
      home: observations(9, 20, 30),
      away: observations(1, 10, 20),
    };
    const post = playoffs([finalSeries([game(0, 1), game(0, 1), latest])]);
    post.playedGames = {
      [latest.id]: officialGameFromArcade(
        finishedGame(latest, input.teams),
        latest,
        input.teams,
      ),
    };
    const before = structuredClone({ input, post });
    const result = captureRivalScouting(input, post)!;
    expect(result.teams[0][0]).toEqual({
      teamId: 1,
      games: 4,
      losses: 1,
      playoffGames: 3,
      threats: [
        {
          pokemonId: 9,
          attempts: 49,
          points: 91.5,
          rimAttempts: 6.5,
          threeAttempts: 3.25,
        },
      ],
    });
    expect(result.teams[1][0]).toEqual({
      teamId: 0,
      games: 4,
      losses: 3,
      playoffGames: 3,
      threats: [
        {
          pokemonId: 1,
          attempts: 54.5,
          points: 109,
          rimAttempts: 51.25,
          threeAttempts: 1.625,
        },
      ],
    });
    expect(captureRivalScouting(input, post)).toEqual(result);
    expect({ input, post }).toEqual(before);
    result.teams[0][0].threats[0].attempts = 0;
    expect({ input, post }).toEqual(before);
  });

  it("reconstructs only the last simulated series game when there is no official result", () => {
    const input = league();
    const latest = game(0, 1);
    latest.scouting = {
      home: observations(9, 1000, 2000),
      away: observations(1),
    };
    const match = simulateMatch(input.teams[0], input.teams[1], latest.seed, {
      scouting: latest.scouting,
    });
    latest.homeScore = match.homeScore;
    latest.awayScore = match.awayScore;
    const result = captureRivalScouting(
      input,
      playoffs([finalSeries([latest])]),
    )!;
    const line = match.awayBox.find((box) => box.pokemonId === 9)!;
    expect(result.teams[0][0].threats[0]).toMatchObject({
      pokemonId: 9,
      attempts: 650 + line.fga,
      points: 1300 + 2 * line.fgm + line.threePM,
    });
    expect(result.teams[0][0]).toMatchObject({
      games: 1,
      playoffGames: 1,
      losses: Number(match.homeScore < match.awayScore),
    });
  });

  it("prioritizes playoff meetings, then troublesome opponents, with stable ID ties", () => {
    const input = league();
    for (let opponent = 1; opponent <= 5; opponent++) {
      for (let i = 0; i < 3; i++)
        input.games.push(
          game(0, opponent, [1, 4].includes(opponent) ? 100 : 80, 90),
        );
      input.scouting![`0:${opponent}`] = observations(opponent * 8 + 1);
    }
    const latest = game(0, 4, 96, 72, "playoff-last");
    latest.scouting = { home: observations(33), away: observations(1) };
    const post = playoffs([finalSeries([game(0, 4), game(0, 4), latest])]);
    post.playedGames = {
      [latest.id]: officialGameFromArcade(
        finishedGame(latest, input.teams),
        latest,
        input.teams,
      ),
    };
    expect(
      captureRivalScouting(input, post)!.teams[0].map((rival) => rival.teamId),
    ).toEqual([4, 2, 3]);
  });

  it("drops unobserved, rounded-away, and out-of-roster threats", () => {
    const input = league();
    input.games = [game(0, 1)];
    input.scouting = {
      "0:1": {
        ...observations(9, 0, 0),
        players: {
          9: { attempts: 0, points: 0, rimAttempts: 0, threeAttempts: 0 },
          10: {
            attempts: 0.0001,
            points: 0.0002,
            rimAttempts: 0,
            threeAttempts: 0,
          },
          1: { attempts: 100, points: 200, rimAttempts: 50, threeAttempts: 20 },
        },
      },
    };
    expect(
      captureRivalScouting(input, playoffs())!.teams[0][0].threats,
    ).toEqual([]);
  });

  it("gives repeated encounters more priority than an isolated loss", () => {
    const input = league();
    input.games = [
      game(0, 1, 80, 90),
      ...Array.from({ length: 6 }, () => game(0, 2)),
    ];
    expect(
      captureRivalScouting(input, playoffs())!.teams[0].map(
        (rival) => rival.teamId,
      ),
    ).toEqual([2, 1]);
  });

  it("does not invent reports for legacy or partially enabled seasons", () => {
    const input = league();
    delete input.scouting;
    expect(captureRivalScouting(input, playoffs())).toBeUndefined();
    input.scouting = {};
    delete input.teams[1].typeTacticsVersion;
    expect(captureRivalScouting(input, playoffs())).toBeUndefined();
  });
});

describe("annual rival report validation", () => {
  it("clones bounded observations and accepts independent three-decimal rounding", () => {
    const input = report();
    input.teams[0][0].threats[0] = {
      pokemonId: 9,
      attempts: 0.333,
      points: 1,
      rimAttempts: 0.167,
      threeAttempts: 0.167,
    };
    const parsed = parseRivalScouting(input, rosters);
    expect(parsed).toEqual(input);
    parsed.teams[0][0].threats[0].points = 0;
    expect(input.teams[0][0].threats[0].points).toBe(1);
    expect(
      parseRivalScouting(
        { version: 1, teams: { 0: [], 1: [], 2: [], 3: [] } },
        rosters.slice(0, 4),
      ),
    ).toEqual({ version: 1, teams: { 0: [], 1: [], 2: [], 3: [] } });
  });

  const malformed: [string, (value: RivalScouting) => unknown][] = [
    [
      "sparse rivals",
      (v) => {
        v.teams[0] = Array(1);
        return v;
      },
    ],
    [
      "extra array field",
      (v) => {
        Object.assign(v.teams[0], { hidden: true });
        return v;
      },
    ],
    [
      "inherited array field",
      (v) => {
        Object.setPrototypeOf(
          v.teams[0],
          Object.assign(Object.create(Array.prototype), { hidden: true }),
        );
        return v;
      },
    ],
    ["nonobject report", () => null],
    ["future version", (v) => ({ ...v, version: 2 })],
    ["extra root field", (v) => ({ ...v, future: true })],
    ["array teams", (v) => ({ ...v, teams: [] })],
    [
      "missing observer",
      (v) => {
        delete v.teams[5];
        return v;
      },
    ],
    [
      "unknown observer",
      (v) => {
        v.teams[6] = [];
        return v;
      },
    ],
    [
      "noncanonical observer",
      (v) => ({ ...v, teams: { ...v.teams, "00": [] } }),
    ],
    [
      "prototype injection",
      (v) => ({
        ...v,
        teams: Object.assign(Object.create({ 6: [] }), v.teams),
      }),
    ],
    [
      "hidden observer",
      (v) => {
        Object.defineProperty(v.teams, "6", { value: [] });
        return v;
      },
    ],
    [
      "symbol key",
      (v) => {
        Object.assign(v.teams, { [Symbol("hidden")]: [] });
        return v;
      },
    ],
    [
      "self rival",
      (v) => {
        v.teams[0][0].teamId = 0;
        return v;
      },
    ],
    [
      "unknown rival",
      (v) => {
        v.teams[0][0].teamId = 6;
        return v;
      },
    ],
    [
      "fractional rival",
      (v) => {
        v.teams[0][0].teamId = 1.5;
        return v;
      },
    ],
    [
      "duplicate rival",
      (v) => {
        v.teams[0].push(structuredClone(v.teams[0][0]));
        return v;
      },
    ],
    [
      "too many rivals",
      (v) => {
        v.teams[0] = [1, 2, 3, 4].map((teamId) => ({
          ...v.teams[0][0],
          teamId,
          threats: [],
        }));
        return v;
      },
    ],
    [
      "unknown rival field",
      (v) => {
        Object.assign(v.teams[0][0], { wins: 2 });
        return v;
      },
    ],
    [
      "no encounters",
      (v) => {
        v.teams[0][0].games = 0;
        return v;
      },
    ],
    [
      "too many encounters",
      (v) => {
        v.teams[0][0].games = 201;
        return v;
      },
    ],
    [
      "fractional encounters",
      (v) => {
        v.teams[0][0].games = 4.5;
        return v;
      },
    ],
    [
      "too many losses",
      (v) => {
        v.teams[0][0].losses = 5;
        return v;
      },
    ],
    [
      "negative losses",
      (v) => {
        v.teams[0][0].losses = -1;
        return v;
      },
    ],
    [
      "fractional losses",
      (v) => {
        v.teams[0][0].losses = 0.5;
        return v;
      },
    ],
    [
      "too many playoff encounters",
      (v) => {
        v.teams[0][0].playoffGames = 5;
        return v;
      },
    ],
    [
      "playoff encounters over bracket limit",
      (v) => {
        Object.assign(v.teams[0][0], { games: 50, playoffGames: 29 });
        return v;
      },
    ],
    [
      "fractional playoff encounters",
      (v) => {
        v.teams[0][0].playoffGames = 0.5;
        return v;
      },
    ],
    [
      "wrong roster threat",
      (v) => {
        v.teams[0][0].threats[0].pokemonId = 1;
        return v;
      },
    ],
    [
      "unknown threat",
      (v) => {
        v.teams[0][0].threats[0].pokemonId = 999;
        return v;
      },
    ],
    [
      "duplicate threat",
      (v) => {
        v.teams[0][0].threats.push(structuredClone(v.teams[0][0].threats[0]));
        return v;
      },
    ],
    [
      "too many threats",
      (v) => {
        v.teams[0][0].threats = [9, 10, 11, 12].map((pokemonId) => ({
          ...v.teams[0][0].threats[0],
          pokemonId,
        }));
        return v;
      },
    ],
    [
      "unknown threat field",
      (v) => {
        Object.assign(v.teams[0][0].threats[0], { wins: 3 });
        return v;
      },
    ],
    [
      "unobserved threat",
      (v) => {
        Object.assign(v.teams[0][0].threats[0], {
          attempts: 0,
          points: 0,
          rimAttempts: 0,
          threeAttempts: 0,
        });
        return v;
      },
    ],
    [
      "nonfinite count",
      (v) => {
        v.teams[0][0].threats[0].attempts = Infinity;
        return v;
      },
    ],
    [
      "nan count",
      (v) => {
        v.teams[0][0].threats[0].points = NaN;
        return v;
      },
    ],
    [
      "negative count",
      (v) => {
        v.teams[0][0].threats[0].rimAttempts = -1;
        return v;
      },
    ],
    [
      "oversized count",
      (v) => {
        v.teams[0][0].threats[0].attempts = 100001;
        return v;
      },
    ],
    [
      "impossible points",
      (v) => {
        v.teams[0][0].threats[0].points = 60.003;
        return v;
      },
    ],
    [
      "overlapping zones",
      (v) => {
        v.teams[0][0].threats[0].threeAttempts = 12.003;
        return v;
      },
    ],
    [
      "missing threat count",
      (v) => {
        Reflect.deleteProperty(v.teams[0][0].threats[0], "attempts");
        return v;
      },
    ],
    [
      "nonarray threats",
      (v) => ({
        ...v,
        teams: { ...v.teams, 0: [{ ...v.teams[0][0], threats: {} }] },
      }),
    ],
  ];
  it.each(malformed)("rejects %s", (_label, mutate) => {
    expect(() => parseRivalScouting(mutate(report()), rosters)).toThrow();
  });
  it("requires a bounded known-team roster list", () => {
    expect(() => parseRivalScouting(report(), rosters.slice(0, 3))).toThrow();
    expect(() =>
      parseRivalScouting(
        report(),
        Array.from({ length: 31 }, () => [1]),
      ),
    ).toThrow();
  });
});
