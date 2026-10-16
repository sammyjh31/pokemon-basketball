import {
  abilitiesEnabled,
  emptyAbilityActivations,
  mergeAbilityActivations,
} from "./abilities";
import { emptyBox } from "./boxscore";
import { nextRandom } from "./random";
import {
  ROSTER_SLOTS,
  type LeagueAward,
  type LeagueBox,
  type LeaguePlayer,
  type LeagueTeam,
  type Standing,
} from "./types";
export const COUNTING_KEYS = [
  "minutes",
  "points",
  "offensiveRebounds",
  "defensiveRebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fgm",
  "fga",
  "threePM",
  "threePA",
  "ftm",
  "fta",
  "fouls",
  "plusMinus",
  "rimFgm",
  "rimFga",
  "midFgm",
  "midFga",
] as const;
export function leaguePlayers(teams: LeagueTeam[]): LeaguePlayer[] {
  return teams.flatMap((team) =>
    ROSTER_SLOTS.map((slot) => ({
      ...emptyBox(team.roster[slot]!, slot),
      ...(abilitiesEnabled(team)
        ? { abilityActivations: emptyAbilityActivations() }
        : {}),
      teamId: team.id,
      teamName: team.name,
      playerId: `${team.id}:${team.roster[slot]}`,
      gamesPlayed: 0,
      gamesStarted: 0,
      doubleDoubles: 0,
      tripleDoubles: 0,
      highPoints: 0,
      playerOfGame: 0,
      fouls: 0,
      plusMinus: 0,
      rimFgm: 0,
      rimFga: 0,
      midFgm: 0,
      midFga: 0,
    })),
  );
}
export function addBox(
  player: LeaguePlayer,
  box: LeagueBox,
  playerOfGameId: string,
) {
  for (const key of COUNTING_KEYS) player[key] += box[key];
  mergeAbilityActivations(player, box);
  player.gamesPlayed += Number(box.minutes > 0);
  player.gamesStarted += Number(box.started);
  player.highPoints = Math.max(player.highPoints, box.points);
  player.playerOfGame += Number(box.playerId === playerOfGameId);
  const doubles = [
    box.points,
    box.offensiveRebounds + box.defensiveRebounds,
    box.assists,
    box.steals,
    box.blocks,
  ].filter((n) => n >= 10).length;
  player.doubleDoubles += Number(doubles >= 2);
  player.tripleDoubles += Number(doubles >= 3);
}
const rebounds = (p: LeaguePlayer) => p.offensiveRebounds + p.defensiveRebounds;
export const playerImpact = (p: LeaguePlayer) =>
  (p.points +
    1.2 * rebounds(p) +
    1.5 * p.assists +
    3 * p.steals +
    3 * p.blocks -
    1.5 * p.turnovers -
    0.4 * (p.fga - p.fgm) -
    0.4 * (p.fta - p.ftm)) /
  Math.max(1, p.gamesPlayed);
/** A repeatable coin flip for exact ties, independent of team or roster order. */
export function seededCoin(seed: number, key: number) {
  return nextRandom((seed ^ Math.imul(key + 1, 0x9e3779b1)) >>> 0).value;
}
const playerKey = (p: LeaguePlayer) => p.teamId * 2048 + p.pokemonId;
/** Court version 3 honors: seeded tiebreaks instead of club order. */
export interface HonorRules {
  balanced: true;
  seed: number;
}
export function leagueHonors(
  players: LeaguePlayer[],
  standings: Standing[],
  gamesPerTeam = 82,
  rules?: HonorRules,
) {
  const minimumGames = Math.ceil((gamesPerTeam * 58) / 82);
  const qualified = players.filter((p) => p.gamesPlayed >= minimumGames);
  const winFactor = (p: LeaguePlayer) =>
    0.9 +
    0.2 * (standings.find((s) => s.teamId === p.teamId)!.wins / gamesPerTeam);
  const availability = (p: LeaguePlayer) =>
    0.9 + (0.1 * p.gamesPlayed) / gamesPerTeam;
  const mvp = (p: LeaguePlayer) =>
    playerImpact(p) * winFactor(p) * availability(p);
  const defense = (p: LeaguePlayer) =>
    ((3 * p.steals +
      3 * p.blocks +
      0.65 * p.defensiveRebounds -
      0.25 * p.fouls) /
      Math.max(1, p.gamesPlayed)) *
    winFactor(p) *
    availability(p);
  const rank = (pool: LeaguePlayer[], score: (p: LeaguePlayer) => number) =>
    [...pool].sort(
      (a, b) =>
        score(b) - score(a) ||
        (rules
          ? seededCoin(rules.seed, playerKey(a)) -
            seededCoin(rules.seed, playerKey(b))
          : 0) ||
        a.teamId - b.teamId ||
        a.pokemonId - b.pokemonId,
    );
  const pg = (value: number, p: LeaguePlayer) =>
    (value / Math.max(1, p.gamesPlayed)).toFixed(1);
  const definitions: {
    id: LeagueAward["id"];
    title: string;
    description: string;
    pool: LeaguePlayer[];
    score: (p: LeaguePlayer) => number;
    value: (p: LeaguePlayer) => string;
  }[] = [
    {
      id: "mvp",
      title: "League MVP",
      description:
        "All-around production, efficiency, availability and team wins.",
      pool: qualified,
      score: mvp,
      value: (p) =>
        `${pg(p.points, p)} PPG · ${pg(rebounds(p), p)} RPG · ${pg(p.assists, p)} APG`,
    },
    {
      id: "defense",
      title: "Defensive Player of the Year",
      description:
        "Steals, blocks and defensive rebounds, balanced against fouls and team wins.",
      pool: qualified,
      score: defense,
      value: (p) => `${pg(p.steals, p)} SPG · ${pg(p.blocks, p)} BPG`,
    },
    {
      id: "sixth",
      title: "Sixth Player of the Year",
      description:
        "Highest impact among players who started fewer than half their games.",
      pool: qualified.filter((p) => p.gamesStarted < p.gamesPlayed / 2),
      score: mvp,
      value: (p) => `${pg(p.points, p)} PPG · ${pg(p.minutes, p)} MPG`,
    },
    {
      id: "scoring",
      title: "Scoring Champion",
      description: `Most points per game; minimum ${minimumGames} games.`,
      pool: qualified,
      score: (p) => p.points / p.gamesPlayed,
      value: (p) => `${pg(p.points, p)} PPG`,
    },
    {
      id: "playmaking",
      title: "Assist Champion",
      description: `Most assists per game; minimum ${minimumGames} games.`,
      pool: qualified,
      score: (p) => p.assists / p.gamesPlayed,
      value: (p) => `${pg(p.assists, p)} APG`,
    },
    {
      id: "rebounding",
      title: "Rebounding Champion",
      description: `Most rebounds per game; minimum ${minimumGames} games.`,
      pool: qualified,
      score: (p) => rebounds(p) / p.gamesPlayed,
      value: (p) => `${pg(rebounds(p), p)} RPG`,
    },
  ];
  const awards: LeagueAward[] = definitions.flatMap((d) => {
    const finalists = rank(d.pool, d.score).slice(0, 3);
    const winner = finalists[0];
    return winner
      ? [
          {
            id: d.id,
            title: d.title,
            description: d.description,
            pokemonId: winner.pokemonId,
            playerId: winner.playerId,
            teamId: winner.teamId,
            score: d.score(winner),
            value: d.value(winner),
            finalists: finalists.map((p) => ({
              playerId: p.playerId,
              teamId: p.teamId,
              pokemonId: p.pokemonId,
              score: d.score(p),
              value: d.value(p),
            })),
          },
        ]
      : [];
  });
  return {
    awards,
    allLeague: rank(qualified, mvp)
      .slice(0, 5)
      .map((p) => p.playerId),
    allDefense: rank(qualified, defense)
      .slice(0, 5)
      .map((p) => p.playerId),
  };
}
