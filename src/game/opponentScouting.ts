import { updatedMoveReads, validateMoveReads } from "./counterTelemetry";
import type { LeagueBox, LeagueMatch, LeagueTeam } from "./types";
import type {
  MatchScouting,
  OpponentScouting,
  ScoutedPlayer,
  ScoutingMemory,
} from "./typeTacticsTypes";

const RECENCY = 0.65;

export function emptyScouting(): OpponentScouting {
  return {
    games: 0,
    possessions: 0,
    pickRolls: 0,
    switches: 0,
    helpRotations: 0,
    players: {},
  };
}

/** A pregame view owns its nested records and cannot acquire future results. */
export function scoutingForMatch(
  memory: ScoutingMemory,
  homeId: number,
  awayId: number,
): MatchScouting {
  return {
    home: structuredClone(memory[`${homeId}:${awayId}`] ?? emptyScouting()),
    away: structuredClone(memory[`${awayId}:${homeId}`] ?? emptyScouting()),
  };
}

function updateOpponent(
  prior: OpponentScouting,
  opponent: LeagueTeam,
  box: LeagueBox[],
  match: LeagueMatch,
  opponentSide: "home" | "away",
  observer: LeagueTeam,
): OpponentScouting {
  const players: Record<number, ScoutedPlayer> = {};
  for (const id of Object.values(opponent.roster)) {
    if (id === null) continue;
    const previous = prior.players[id];
    players[id] = {
      attempts: (previous?.attempts ?? 0) * RECENCY,
      points: (previous?.points ?? 0) * RECENCY,
      rimAttempts: (previous?.rimAttempts ?? 0) * RECENCY,
      threeAttempts: (previous?.threeAttempts ?? 0) * RECENCY,
    };
  }
  for (const line of box) {
    const player = players[line.pokemonId];
    if (!player) continue;
    player.attempts += line.fga;
    player.points += 2 * line.fgm + line.threePM;
    player.rimAttempts += line.rimFga;
    player.threeAttempts += line.threePA;
  }
  const tactics = match.typeTactics?.[opponentSide];
  return {
    ...(observer.movesetVersion === 3 &&
    observer.engineRules?.adaptiveCoaching !== false &&
    observer.engineRules?.abilities !== false
      ? {
          moveReads: updatedMoveReads(
            prior.moveReads,
            match.moveObservations?.[opponentSide],
          ),
        }
      : {}),
    ...(prior.carried === 1 ? { carried: 1 as const } : {}),
    games: prior.games + 1,
    possessions: prior.possessions * RECENCY + match.possessions,
    pickRolls: prior.pickRolls * RECENCY + match.plays.pickRoll[opponentSide],
    switches: prior.switches * RECENCY + (tactics?.switches ?? 0),
    helpRotations:
      prior.helpRotations * RECENCY + (tactics?.helpRotations ?? 0),
    players,
  };
}

/** Call only after a completed game. Only these two encounter entries change. */
export function recordScouting(
  memory: ScoutingMemory,
  home: LeagueTeam,
  away: LeagueTeam,
  match: LeagueMatch,
): void {
  const homeKey = `${home.id}:${away.id}`,
    awayKey = `${away.id}:${home.id}`;
  memory[homeKey] = updateOpponent(
    memory[homeKey] ?? emptyScouting(),
    away,
    match.awayBox,
    match,
    "away",
    home,
  );
  memory[awayKey] = updateOpponent(
    memory[awayKey] ?? emptyScouting(),
    home,
    match.homeBox,
    match,
    "home",
    away,
  );
}

const HISTORY_KEYS = [
  "games",
  "possessions",
  "pickRolls",
  "switches",
  "helpRotations",
  "players",
] as const;
const PLAYER_KEYS = [
  "attempts",
  "points",
  "rimAttempts",
  "threeAttempts",
] as const;
const invalid = (): never => {
  throw new Error("Invalid opponent scouting context.");
};

function record(
  value: unknown,
  keys?: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key !== "string")) return invalid();
  if (
    keys &&
    (ownKeys.length !== keys.length ||
      !keys.every((key) => Object.hasOwn(value, key)))
  )
    return invalid();
  return value as Record<string, unknown>;
}

function count(value: unknown, max = 1_000_000): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max
  )
    return invalid();
  return value;
}

export function validateOpponentScouting(
  value: unknown,
  opponent: Pick<LeagueTeam, "roster" | "movesetVersion">,
): OpponentScouting {
  const hasReads =
    !!value && typeof value === "object" && Object.hasOwn(value, "moveReads");
  const carried =
    !!value && typeof value === "object" && Object.hasOwn(value, "carried");
  if (
    carried &&
    ((value as Record<string, unknown>).carried !== 1 ||
      opponent.movesetVersion !== 3)
  )
    return invalid();
  if (hasReads && opponent.movesetVersion !== 3) return invalid();
  const input = record(value, [
      ...HISTORY_KEYS,
      ...(hasReads ? ["moveReads"] : []),
      ...(carried ? ["carried"] : []),
    ]),
    games = count(input.games, 1000),
    possessions = count(input.possessions),
    pickRolls = count(input.pickRolls),
    switches = count(input.switches),
    helpRotations = count(input.helpRotations),
    inputPlayers = record(input.players),
    playerIds = Object.getOwnPropertyNames(inputPlayers),
    roster = new Set(Object.values(opponent.roster));
  if (!Number.isInteger(games) || playerIds.length > 8) return invalid();
  if (
    games === 0 &&
    (possessions ||
      pickRolls ||
      switches ||
      helpRotations ||
      (!carried && playerIds.length))
  )
    return invalid();
  const players: Record<number, ScoutedPlayer> = {};
  for (const key of playerIds) {
    const id = Number(key);
    if (
      !Number.isInteger(id) ||
      id <= 0 ||
      String(id) !== key ||
      !roster.has(id)
    )
      return invalid();
    const player = record(inputPlayers[key], PLAYER_KEYS),
      attempts = count(player.attempts),
      points = count(player.points),
      rimAttempts = count(player.rimAttempts),
      threeAttempts = count(player.threeAttempts);
    // The discount can leave fractional counts and tiny floating-point residue.
    if (
      points > 3 * attempts + 1e-6 ||
      rimAttempts + threeAttempts > attempts + 1e-6
    )
      return invalid();
    players[id] = { attempts, points, rimAttempts, threeAttempts };
  }
  const moveReads = hasReads ? validateMoveReads(input.moveReads) : undefined;
  if (
    games === 0 &&
    !carried &&
    moveReads &&
    (Object.keys(moveReads.moves).length ||
      Object.keys(moveReads.combos).length)
  )
    return invalid();
  return {
    ...(carried ? { carried: 1 as const } : {}),
    games,
    possessions,
    pickRolls,
    switches,
    helpRotations,
    players,
    ...(moveReads ? { moveReads } : {}),
  };
}

/** Validate external pregame observations and return an independently owned view. */
export function validateMatchScouting(
  value: unknown,
  home: LeagueTeam,
  away: LeagueTeam,
): MatchScouting {
  const input = record(value, ["home", "away"]);
  return {
    home: validateOpponentScouting(input.home, away),
    away: validateOpponentScouting(input.away, home),
  };
}
