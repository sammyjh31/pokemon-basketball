import type { FranchiseSeason } from "./franchiseTypes";
import type { SeasonReplayArchive } from "./franchiseFeatures";
import type {
  LeagueGameSummary,
  LeagueMatch,
  Run,
  SeasonResult,
} from "./types";
import { simulateSeason, simulateSeasonAsync } from "./season";
import { simulateMatch } from "./match";

/** Store inputs, player totals and the small bracket; simulated boxes stay derived. */
export function captureSeasonReplay(run: Run): SeasonReplayArchive {
  const result = run.result;
  if (
    !result?.league ||
    !run.playoffs ||
    ![3, 4, 5, 6].includes(result.modelVersion ?? 0)
  )
    throw new Error("Only completed league seasons can be archived.");
  return structuredClone({
    modelVersion: 1,
    seasonModel: result.modelVersion as SeasonReplayArchive["seasonModel"],
    teams: result.league.teams,
    regularPlayers: result.league.players,
    playoffPlayers: run.playoffs.players,
    playedGames: run.seasonProgress?.playedGames ?? {},
    playoffs: run.playoffs,
  });
}

export function archivedSeasonRun(season: FranchiseSeason): Run {
  if (!season.replay)
    throw new Error(
      "Detailed game history is unavailable for this older season.",
    );
  const replay = season.replay,
    user = replay.teams[0];
  return {
    id: `run-${season.seasonSeed}`,
    mode: "free",
    includeLegends: true,
    ...(user.coach ? { coach: user.coach } : {}),
    roster: { ...user.roster },
    offerIds: [],
    rerollsLeft: 0,
    draftSeed: 0,
    seasonSeed: season.seasonSeed,
    tactic: user.tactic,
    rotation: user.rotation,
    defense: user.defense,
    leagueTeams: replay.teams,
    ...(user.abilityVersion === 1 ? { abilityVersion: 1 as const } : {}),
    ...(user.evaluationVersion === 1 ? { evaluationVersion: 1 as const } : {}),
    ...(user.courtVersion === 1 ? { courtVersion: 1 as const } : {}),
    ...(user.matchupVersion === 1 ? { matchupVersion: 1 as const } : {}),
    ...(user.possessionVersion === 1 ? { possessionVersion: 1 as const } : {}),
    ...(user.typeTacticsVersion === 1
      ? { typeTacticsVersion: 1 as const }
      : {}),
    ...(user.typeMatchupsVersion === 1
      ? { typeMatchupsVersion: 1 as const }
      : {}),
    ...(user.rotationPlan ? { rotationPlan: user.rotationPlan } : {}),
    ...(replay.seasonModel === 6
      ? {
          seasonProgress: {
            modelVersion: 1 as const,
            completedRounds: 0,
            playedGames: replay.playedGames,
          },
        }
      : {}),
    result: null,
  };
}

/** Frozen clubs intentionally bypass current franchise rosters and development. */
export function replayArchivedSeasonSync(
  season: FranchiseSeason,
): SeasonResult {
  const result = simulateSeason(archivedSeasonRun(season));
  return { ...result, modelVersion: season.replay!.seasonModel };
}
export async function replayArchivedSeason(
  season: FranchiseSeason,
  onProgress?: (completed: number, total: number) => void,
  signal?: AbortSignal,
): Promise<SeasonResult> {
  const result = await simulateSeasonAsync(
    archivedSeasonRun(season),
    onProgress,
    signal,
  );
  return { ...result, modelVersion: season.replay!.seasonModel };
}

export function resolveArchivedMatch(
  season: FranchiseSeason,
  game: LeagueGameSummary,
  phase: "regular" | "playoffs" = "regular",
): LeagueMatch {
  if (!season.replay)
    throw new Error(
      "Detailed game history is unavailable for this older season.",
    );
  const replay = season.replay;
  const overrides =
    phase === "regular" ? replay.playedGames : replay.playoffs.playedGames;
  const official = overrides?.[game.id];
  return (
    official?.match ??
    simulateMatch(
      replay.teams[game.homeTeamId],
      replay.teams[game.awayTeamId],
      game.seed,
      { scouting: game.scouting },
    )
  );
}
