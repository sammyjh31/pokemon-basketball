import { mergePossessionInsights } from "./possessionAnalysis";
import type { PossessionInsights } from "./possessionTypes";
import { simulateMatch } from "./match";
import type {
  DefenseSummary,
  LineupSummary,
  ShotEvent,
} from "./engineInsightsTypes";
import type {
  LeagueBox,
  LeagueGameSummary,
  LeagueMatch,
  LeagueResult,
} from "./types";

const ratio = (value: number, count: number) =>
  count > 0 && Number.isFinite(value) ? value / count : null;
export function shotSummary(shots: ShotEvent[]) {
  const attempts = shots.filter((shot) => shot.countsAsAttempt).length;
  const made = shots.filter((shot) => shot.made).length;
  return {
    events: shots.length,
    attempts,
    made,
    points: shots.reduce((sum, shot) => sum + (shot.made ? shot.value : 0), 0),
    expectedPoints: shots.reduce(
      (sum, shot) => sum + shot.value * shot.expectedProbability,
      0,
    ),
    fieldGoalPercent: ratio(made * 100, attempts),
  };
}
export function lineupMetrics(lineup: LineupSummary) {
  return {
    minutes: lineup.seconds / 60,
    plusMinus: lineup.pointsFor - lineup.pointsAgainst,
    pointsPer100: ratio(lineup.pointsFor * 100, lineup.possessions),
  };
}
export function gameDrivers(match: LeagueMatch) {
  const totals = (key: "turnovers" | "offensiveRebounds" | "ftm") => ({
    home: match.homeBox.reduce((sum, box) => sum + box[key], 0),
    away: match.awayBox.reduce((sum, box) => sum + box[key], 0),
  });
  const homeId = match.homeBox[0]?.teamId,
    awayId = match.awayBox[0]?.teamId;
  return {
    turnovers: totals("turnovers"),
    offensiveRebounds: totals("offensiveRebounds"),
    freeThrows: totals("ftm"),
    shooting: match.insights
      ? {
          home: shotSummary(
            match.insights.shots.filter(
              (shot) => shot.offenseTeamId === homeId,
            ),
          ),
          away: shotSummary(
            match.insights.shots.filter(
              (shot) => shot.offenseTeamId === awayId,
            ),
          ),
        }
      : null,
  };
}

export interface PlayerGameTrend {
  gameId: string;
  round: number;
  opponentId: number;
  home: boolean;
  status: "played" | "dnp" | "unavailable";
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  fgm: number;
  fga: number;
  plusMinus: number;
}
export type SeasonLineup = LineupSummary & { games: number };
export type SeasonDefense = DefenseSummary & { games: number };
export interface SeasonInsights {
  possession?: PossessionInsights;
  games: number;
  detailGames: number;
  missingTelemetryGames: number;
  unavailableGames: number;
  players: Record<string, PlayerGameTrend[]>;
  lineups: SeasonLineup[];
  defense: SeasonDefense[];
}
export function playerTrendSummary(rows: PlayerGameTrend[], window: number) {
  const recent = window > 0 ? rows.slice(-window) : [],
    played = recent.filter((row) => row.status === "played");
  const average = (key: "points" | "rebounds" | "assists" | "minutes") =>
    ratio(
      played.reduce((sum, row) => sum + row[key], 0),
      played.length,
    );
  return {
    games: played.length,
    scheduled: recent.length,
    points: average("points"),
    rebounds: average("rebounds"),
    assists: average("assists"),
    minutes: average("minutes"),
  };
}
export type InsightMatchResolver = (
  game: LeagueGameSummary,
) => LeagueMatch | undefined;
const seasonCache = new WeakMap<
  LeagueResult,
  { resolver?: InsightMatchResolver; result: SeasonInsights }
>();
const yieldToBrowser = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Holds compact summaries only. Official results must be supplied by their authoritative resolver. */
export async function buildSeasonInsights(
  league: LeagueResult,
  options: {
    resolveMatch?: InsightMatchResolver;
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<SeasonInsights> {
  const { signal, onProgress, resolveMatch } = options;
  signal?.throwIfAborted();
  const cached = seasonCache.get(league);
  if (cached && cached.resolver === resolveMatch) {
    onProgress?.(league.games.length, league.games.length);
    return cached.result;
  }
  const data: SeasonInsights = {
    games: league.games.length,
    detailGames: 0,
    missingTelemetryGames: 0,
    unavailableGames: 0,
    players: {},
    lineups: [],
    defense: [],
  };
  const teams = new Map(league.teams.map((team) => [team.id, team]));
  const lineups = new Map<string, SeasonLineup>(),
    defense = new Map<string, SeasonDefense>();
  const games = [...league.games].sort((a, b) => a.round - b.round);
  onProgress?.(0, games.length);
  for (const [index, game] of games.entries()) {
    signal?.throwIfAborted();
    if (index % 4 === 0) await yieldToBrowser();
    signal?.throwIfAborted();
    const home = teams.get(game.homeTeamId),
      away = teams.get(game.awayTeamId);
    let match: LeagueMatch | undefined;
    if (home && away) {
      match = resolveMatch
        ? resolveMatch(game)
        : simulateMatch(home, away, game.seed, { scouting: game.scouting });
      if (
        match &&
        (match.homeScore !== game.homeScore ||
          match.awayScore !== game.awayScore ||
          match.overtimePeriods !== game.overtimePeriods)
      )
        match = undefined;
    }
    if (!match) data.unavailableGames++;
    else if (!match.insights) data.missingTelemetryGames++;
    else data.detailGames++;
    for (const [team, opponentId, isHome, boxes] of [
      [home, game.awayTeamId, true, match?.homeBox],
      [away, game.homeTeamId, false, match?.awayBox],
    ] as const) {
      if (!team) continue;
      const byPlayer = new Map(
        boxes?.map((box: LeagueBox) => [box.playerId, box]),
      );
      for (const pokemonId of Object.values(team.roster)) {
        if (pokemonId === null) continue;
        const playerId = `${team.id}:${pokemonId}`,
          box = byPlayer.get(playerId);
        (data.players[playerId] ??= []).push({
          gameId: game.id,
          round: game.round,
          opponentId,
          home: isHome,
          status: !box ? "unavailable" : box.minutes > 0 ? "played" : "dnp",
          minutes: box?.minutes ?? 0,
          points: box?.points ?? 0,
          rebounds: box ? box.offensiveRebounds + box.defensiveRebounds : 0,
          assists: box?.assists ?? 0,
          fgm: box?.fgm ?? 0,
          fga: box?.fga ?? 0,
          plusMinus: box?.plusMinus ?? 0,
        });
      }
    }
    if (match?.insights?.possession)
      data.possession = mergePossessionInsights(
        data.possession ?? { version: 1, teams: [], players: [] },
        match.insights.possession,
      );
    const seenLineups = new Set<string>(),
      seenDefense = new Set<string>();
    for (const row of match?.insights?.lineups ?? []) {
      if (row.playerIds.length !== 5 || new Set(row.playerIds).size !== 5)
        continue;
      const playerIds = [...row.playerIds].sort(),
        key = `${row.teamId}|${playerIds.join("|")}${row.chemistryContext ? `:${row.chemistryContext.tactic}:${row.chemistryContext.defense}` : ""}`;
      const total = lineups.get(key) ?? {
        ...row,
        playerIds,
        seconds: 0,
        possessions: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        games: 0,
      };
      for (const key of [
        "seconds",
        "possessions",
        "pointsFor",
        "pointsAgainst",
      ] as const)
        total[key] += row[key];
      if (!seenLineups.has(key)) total.games++;
      seenLineups.add(key);
      lineups.set(key, total);
    }
    for (const row of match?.insights?.defense ?? []) {
      const total = defense.get(row.playerId) ?? {
        ...row,
        matchups: 0,
        attempts: 0,
        contests: 0,
        pointsAllowed: 0,
        expectedPointsAllowed: 0,
        blocks: 0,
        steals: 0,
        deflections: 0,
        shootingFouls: 0,
        games: 0,
      };
      for (const key of [
        "matchups",
        "attempts",
        "contests",
        "pointsAllowed",
        "expectedPointsAllowed",
        "blocks",
        "steals",
        "deflections",
        "shootingFouls",
      ] as const)
        total[key] += row[key];
      if (!seenDefense.has(row.playerId)) total.games++;
      seenDefense.add(row.playerId);
      defense.set(row.playerId, total);
    }
    onProgress?.(index + 1, games.length);
  }
  signal?.throwIfAborted();
  data.lineups = [...lineups.values()].sort((a, b) => b.seconds - a.seconds);
  data.defense = [...defense.values()].sort((a, b) => b.matchups - a.matchups);
  seasonCache.set(league, { resolver: resolveMatch, result: data });
  return data;
}
