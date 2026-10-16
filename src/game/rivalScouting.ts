import { recordScouting } from "./opponentScouting";
import { resolvePlayoffMatch } from "./playoffs";
import type { Playoffs } from "./playoffTypes";
import type { RivalRecord, RivalScouting } from "./rivalScoutingTypes";
import type { ScoutingMemory } from "./typeTacticsTypes";
import type { LeagueGameSummary, LeagueResult } from "./types";

const rounded = (value: number) => Math.round(value * 1000) / 1000;
const priority = (rival: RivalRecord) =>
  Math.min(rival.games, 12) +
  (4 * rival.losses) / rival.games +
  2 * Math.min(rival.playoffGames, 7);

/** Archive observed opponents without replaying an entire completed season. */
export function captureRivalScouting(
  league: LeagueResult,
  playoffs: Playoffs,
): RivalScouting | undefined {
  if (
    !league.scouting ||
    !league.teams.every((team) => team.typeTacticsVersion === 1)
  )
    return undefined;
  const memory: ScoutingMemory = { ...league.scouting };
  const teams = new Map(league.teams.map((team) => [team.id, team]));
  const encounters = new Map<number, Map<number, RivalRecord>>(
    league.teams.map((team) => [team.id, new Map()]),
  );
  const countGame = (game: LeagueGameSummary, playoff: boolean) => {
    for (const [observer, opponent, lost] of [
      [game.homeTeamId, game.awayTeamId, game.homeScore < game.awayScore],
      [game.awayTeamId, game.homeTeamId, game.awayScore < game.homeScore],
    ] as const) {
      const opponents = encounters.get(observer)!;
      const rival = opponents.get(opponent) ?? {
        teamId: opponent,
        games: 0,
        losses: 0,
        playoffGames: 0,
        threats: [],
      };
      rival.games++;
      rival.losses += Number(lost);
      rival.playoffGames += Number(playoff);
      opponents.set(opponent, rival);
    }
  };
  for (const game of league.games) countGame(game, false);
  for (const series of playoffs.series) {
    for (const game of series.games) countGame(game, true);
    const latest = series.games.at(-1);
    if (series.winnerId === null || !latest) continue;
    const home = teams.get(latest.homeTeamId)!,
      away = teams.get(latest.awayTeamId)!;
    // A finished bracket discards live scouting, but its final pregame context
    // includes all earlier encounters. Apply the final result exactly once.
    if (latest.scouting) {
      memory[`${home.id}:${away.id}`] = latest.scouting.home;
      memory[`${away.id}:${home.id}`] = latest.scouting.away;
    }
    recordScouting(
      memory,
      home,
      away,
      resolvePlayoffMatch(latest, league.teams, playoffs.playedGames),
    );
  }
  const result: RivalScouting = { version: 1, teams: {} };
  for (const [observer, opponents] of encounters) {
    result.teams[observer] = [...opponents.values()]
      .sort((a, b) => priority(b) - priority(a) || a.teamId - b.teamId)
      .slice(0, 3)
      .map((rival) => {
        const roster = new Set(Object.values(teams.get(rival.teamId)!.roster));
        const observed = memory[`${observer}:${rival.teamId}`]?.players ?? {};
        const threats = Object.entries(observed)
          .filter(
            ([id, player]) =>
              roster.has(Number(id)) && rounded(player.attempts) > 0,
          )
          .map(([id, player]) => ({ pokemonId: Number(id), ...player }))
          .sort(
            (a, b) =>
              b.points + b.attempts * 0.25 - (a.points + a.attempts * 0.25) ||
              a.pokemonId - b.pokemonId,
          )
          .slice(0, 3)
          .map((player) => ({
            pokemonId: player.pokemonId,
            attempts: rounded(player.attempts),
            points: rounded(player.points),
            rimAttempts: rounded(player.rimAttempts),
            threeAttempts: rounded(player.threeAttempts),
          }));
        return { ...rival, threats };
      });
  }
  return result;
}

const invalid = (): never => {
  throw new Error("Invalid annual rival scouting.");
};
function record(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    !keys.every((key) => Object.hasOwn(value, key))
  )
    return invalid();
  return value as Record<string, unknown>;
}
function count(value: unknown, max = 100_000): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    return invalid();
  return value;
}
function integer(value: unknown, max: number): number {
  const result = count(value, max);
  if (!Number.isInteger(result)) return invalid();
  return result;
}
function list(value: unknown, max: number): unknown[] {
  if (
    !Array.isArray(value) ||
    value.length > max ||
    Object.getPrototypeOf(value) !== Array.prototype
  )
    return invalid();
  const keys = Reflect.ownKeys(value);
  if (
    keys.length !== value.length + 1 ||
    !Array.from({ length: value.length }, (_, i) =>
      Object.hasOwn(value, i),
    ).every(Boolean)
  )
    return invalid();
  return value;
}

/** Strictly validate saved reports against the archived opponent rosters. */
export function parseRivalScouting(
  value: unknown,
  rosters: readonly (readonly number[])[],
): RivalScouting {
  if (
    !Array.isArray(rosters) ||
    rosters.length < 4 ||
    rosters.length > 30 ||
    Array.from(rosters).some((roster) => !Array.isArray(roster))
  )
    return invalid();
  const input = record(value, ["version", "teams"]);
  if (input.version !== 1) return invalid();
  const teamKeys = Array.from({ length: rosters.length }, (_, id) =>
    String(id),
  );
  const inputTeams = record(input.teams, teamKeys);
  const result: RivalScouting = { version: 1, teams: {} };
  for (const observer of teamKeys) {
    const seenRivals = new Set<number>();
    result.teams[Number(observer)] = list(inputTeams[observer], 3).map(
      (value) => {
        const rival = record(value, [
          "teamId",
          "games",
          "losses",
          "playoffGames",
          "threats",
        ]);
        const teamId = integer(rival.teamId, rosters.length - 1);
        if (teamId === Number(observer) || seenRivals.has(teamId))
          return invalid();
        seenRivals.add(teamId);
        const games = integer(rival.games, 200),
          losses = integer(rival.losses, games),
          playoffGames = integer(rival.playoffGames, Math.min(28, games));
        if (games === 0) return invalid();
        const seenThreats = new Set<number>(),
          roster = new Set(rosters[teamId]);
        const threats = list(rival.threats, 3).map((value) => {
          const player = record(value, [
            "pokemonId",
            "attempts",
            "points",
            "rimAttempts",
            "threeAttempts",
          ]);
          const pokemonId = integer(player.pokemonId, Number.MAX_SAFE_INTEGER);
          if (!roster.has(pokemonId) || seenThreats.has(pokemonId))
            return invalid();
          seenThreats.add(pokemonId);
          const attempts = count(player.attempts),
            points = count(player.points),
            rimAttempts = count(player.rimAttempts),
            threeAttempts = count(player.threeAttempts);
          // Each independently rounded count may differ by half a thousandth.
          const epsilon = 0.002 + 1e-9;
          if (
            attempts === 0 ||
            points > attempts * 3 + epsilon ||
            rimAttempts + threeAttempts > attempts + epsilon
          )
            return invalid();
          return { pokemonId, attempts, points, rimAttempts, threeAttempts };
        });
        return { teamId, games, losses, playoffGames, threats };
      },
    );
  }
  return result;
}
