import type {
  LeagueBox,
  LeagueGameSummary,
  LeagueMatch,
  LeagueResult,
  LeagueTeam,
} from "./types";
import type { ShotEvent } from "./engineInsightsTypes";

export const insightTeams: LeagueTeam[] = [0, 1].map((id) => ({
  id,
  name: id ? "Away club" : "Home club",
  tactic: "balanced",
  rotation: "balanced",
  defense: "man",
  roster: id
    ? { PG: 9, SG: 10, SF: 11, PF: 12, C: 13, B1: 14, B2: 15, B3: 16 }
    : { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, B1: 6, B2: 7, B3: 8 },
  ratings: { offense: 60, defense: 60, overall: 60, filled: 5, complete: true },
}));
export function insightBox(overrides: Partial<LeagueBox> = {}): LeagueBox {
  return {
    pokemonId: 1,
    playerId: "0:1",
    teamId: 0,
    slot: "PG",
    started: true,
    minutes: 30,
    points: 10,
    offensiveRebounds: 1,
    defensiveRebounds: 2,
    assists: 3,
    steals: 1,
    blocks: 0,
    turnovers: 2,
    fgm: 4,
    fga: 10,
    threePM: 0,
    threePA: 2,
    ftm: 2,
    fta: 2,
    fouls: 1,
    plusMinus: 3,
    rimFgm: 3,
    rimFga: 5,
    midFgm: 1,
    midFga: 3,
    ...overrides,
  };
}
export function insightShot(overrides: Partial<ShotEvent> = {}): ShotEvent {
  return {
    index: 0,
    period: 1,
    elapsedSeconds: 10,
    offenseTeamId: 0,
    defenseTeamId: 1,
    shooterId: "0:1",
    defenderId: "1:9",
    zone: "rim",
    play: "post",
    value: 2,
    expectedProbability: 0.5,
    made: true,
    blocked: false,
    foul: false,
    countsAsAttempt: true,
    contested: true,
    x: 50,
    y: 15,
    ...overrides,
  };
}
export function insightMatch(
  overrides: Partial<LeagueMatch> = {},
): LeagueMatch {
  return {
    homeScore: 10,
    awayScore: 7,
    homeBox: [insightBox()],
    awayBox: [
      insightBox({
        teamId: 1,
        pokemonId: 9,
        playerId: "1:9",
        points: 7,
        turnovers: 4,
        offensiveRebounds: 0,
        ftm: 1,
      }),
    ],
    overtimePeriods: 0,
    possessions: 10,
    periods: [{ home: 10, away: 7 }],
    leadChanges: 1,
    largestLead: { home: 3, away: 2 },
    plays: {
      transition: { home: 0, away: 0 },
      pickRoll: { home: 0, away: 0 },
      isolation: { home: 0, away: 0 },
      post: { home: 1, away: 1 },
      spotUp: { home: 0, away: 0 },
    },
    playerOfGameId: "0:1",
    insights: {
      version: 1,
      coordinateSystem: "schematic-half-court",
      shots: [
        insightShot(),
        insightShot({
          index: 1,
          zone: "three",
          value: 3,
          made: false,
          expectedProbability: 0.25,
          x: 15,
          y: 60,
        }),
        insightShot({
          index: 2,
          made: false,
          foul: true,
          countsAsAttempt: false,
          expectedProbability: 0.2,
        }),
      ],
      lineups: [
        {
          teamId: 0,
          playerIds: ["0:1", "0:2", "0:3", "0:4", "0:5"],
          seconds: 600,
          possessions: 5,
          pointsFor: 8,
          pointsAgainst: 6,
        },
      ],
      defense: [
        {
          teamId: 1,
          playerId: "1:9",
          matchups: 3,
          attempts: 2,
          contests: 3,
          pointsAllowed: 2,
          expectedPointsAllowed: 2.15,
          blocks: 0,
          steals: 1,
          deflections: 2,
          shootingFouls: 1,
        },
      ],
      adjustments: [],
    },
    ...overrides,
  };
}
export function insightGame(index = 0): LeagueGameSummary {
  return {
    id: `g${index}`,
    round: index,
    homeTeamId: 0,
    awayTeamId: 1,
    seed: index,
    homeScore: 10,
    awayScore: 7,
    overtimePeriods: 0,
  };
}
export function insightLeague(count = 1): LeagueResult {
  return {
    teams: insightTeams,
    games: Array.from({ length: count }, (_, index) => insightGame(index)),
    players: [],
    standings: [],
    awards: [],
    allLeague: [],
    allDefense: [],
  };
}
