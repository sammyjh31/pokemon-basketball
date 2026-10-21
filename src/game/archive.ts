import { isMovesetVersion } from "./basketballMoves";
import { masteryGameXpCap, masteryLevel } from "./masteryMath";
import { nextRandom } from "./random";
import type { FranchiseSeason } from "./franchiseTypes";
import type { SeasonReplayArchive } from "./franchiseFeatures";
import type {
  LeagueGameSummary,
  LeagueMatch,
  Run,
  SeasonResult,
} from "./types";
import { seasonBuilder, simulateSeason, simulateSeasonAsync } from "./season";
import { simulateMatch } from "./match";
import { validateLeagueTeams } from "./franchiseValidation";

/** Compare actual engine inputs, never the saved scores or totals being checked.
 * Building an empty projection identifies the rules and clubs without playing games.
 */
export function hasMatchingSeasonInputs(
  run: Run,
  seasonSeed: number,
  replay: Pick<SeasonReplayArchive, "teams" | "seasonModel" | "playedGames">,
): boolean {
  if (
    run.seasonSeed !== seasonSeed ||
    (run.seasonProgress && run.seasonProgress.completedRounds !== 82)
  )
    return false;
  const expected = seasonBuilder({ ...run, result: null }).finish();
  return (
    expected.modelVersion === replay.seasonModel &&
    JSON.stringify(
      validateLeagueTeams(expected.league!.teams, run.includeLegends),
    ) ===
      JSON.stringify(validateLeagueTeams(replay.teams, run.includeLegends)) &&
    JSON.stringify(run.seasonProgress?.playedGames ?? {}) ===
      JSON.stringify(replay.playedGames)
  );
}

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
    ...(user.shinySeed !== undefined ? { shinySeed: user.shinySeed } : {}),
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
    ...(user.abilityMasteryVersion === 1
      ? { abilityMasteryVersion: 1 as const }
      : {}),
    ...(user.physicalAbilityVersion === 1
      ? { physicalAbilityVersion: 1 as const }
      : {}),
    ...(user.chemistryVersion === 1 ? { chemistryVersion: 1 as const } : {}),
    ...(user.personalityVersion === 1
      ? { personalityVersion: 1 as const }
      : {}),
    ...(user.moraleVersion === 1 ? { moraleVersion: 1 as const } : {}),
    ...(user.chemistryGrowthVersion === 1
      ? { chemistryGrowthVersion: 1 as const }
      : {}),
    ...(user.evaluationVersion === 1 ? { evaluationVersion: 1 as const } : {}),
    ...(user.courtVersion ? { courtVersion: user.courtVersion } : {}),
    ...(user.gameFlowVersion === 1 ? { gameFlowVersion: 1 as const } : {}),
    ...(isMovesetVersion(user.movesetVersion)
      ? { movesetVersion: user.movesetVersion }
      : {}),
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
      {
        scouting: game.scouting,
        chemistry: game.chemistry,
        morale: game.morale,
        mastery: game.mastery,
        flow: game.flow,
      },
    )
  );
}

/** Compact recorded news facts omit the large pregame replay snapshots. */
export function captureNewsGames(
  regular: LeagueGameSummary[],
  playoffs: import("./playoffTypes").Playoffs,
): LeagueGameSummary[] {
  return [...regular, ...playoffs.series.flatMap((series) => series.games)].map(
    (game) => ({
      id: game.id,
      round: game.round,
      homeTeamId: game.homeTeamId,
      awayTeamId: game.awayTeamId,
      seed: game.seed,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      overtimePeriods: game.overtimePeriods,
      ...(game.masteryMilestones?.length
        ? { masteryMilestones: structuredClone(game.masteryMilestones) }
        : {}),
    }),
  );
}

/** Old archives may have recorded facts without replay inputs; still validate every field. */
export function validateNewsGames(
  value: unknown,
  fixtures: import("./types").LeagueFixture[],
  rosters: number[][],
  seasonSeed: number,
  courtVersion?: import("./courtTypes").CourtVersion,
): LeagueGameSummary[] {
  const fail = (): never => {
    throw new Error("Invalid archived news game facts.");
  };
  const record = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  const integer = (v: unknown, low: number, high: number): v is number =>
    Number.isInteger(v) && (v as number) >= low && (v as number) <= high;
  const xp = (v: unknown): v is number =>
    typeof v === "number" &&
    Number.isFinite(v) &&
    v >= 0 &&
    v <= 1000 &&
    Math.abs(v - Math.round(v * 100) / 100) < 1e-7;
  if (
    !Array.isArray(value) ||
    value.length < fixtures.length ||
    value.length > fixtures.length + 105
  )
    return fail();
  const ids = new Set<string>();
  return value.map((raw, index) => {
    if (
      !record(raw) ||
      typeof raw.id !== "string" ||
      ids.has(raw.id) ||
      Object.keys(raw).some(
        (key) =>
          ![
            "id",
            "round",
            "homeTeamId",
            "awayTeamId",
            "seed",
            "homeScore",
            "awayScore",
            "overtimePeriods",
            "masteryMilestones",
          ].includes(key),
      ) ||
      !integer(raw.homeTeamId, 0, rosters.length - 1) ||
      !integer(raw.awayTeamId, 0, rosters.length - 1) ||
      raw.homeTeamId === raw.awayTeamId ||
      !integer(raw.seed, 0, 0xffffffff) ||
      !integer(raw.homeScore, 0, 1000000) ||
      !integer(raw.awayScore, 0, 1000000) ||
      raw.homeScore === raw.awayScore ||
      !integer(raw.overtimePeriods, 0, 100)
    )
      return fail();
    ids.add(raw.id);
    const fixture = fixtures[index];
    if (fixture) {
      if (
        raw.id !== fixture.id ||
        raw.round !== fixture.round ||
        raw.seed !== fixture.seed ||
        raw.homeTeamId !== fixture.homeTeamId ||
        raw.awayTeamId !== fixture.awayTeamId
      )
        return fail();
    } else {
      const match = /^p1-r([1-4])-s([1-8])-g([1-7])$/.exec(raw.id);
      if (!match) return fail();
      const round = Number(match[1]) - 1,
        series = Number(match[2]) - 1,
        game = Number(match[3]) - 1;
      if (
        raw.round !== round ||
        series >= 2 ** (3 - round) ||
        raw.seed !==
          nextRandom(
            (seasonSeed ^
              0x5a71c3e9 ^
              Math.imul(1 + round * 56 + series * 7 + game, 0x9e3779b1)) >>>
              0,
          ).seed
      )
        return fail();
    }
    if (raw.masteryMilestones !== undefined) {
      if (
        !Array.isArray(raw.masteryMilestones) ||
        raw.masteryMilestones.length < 1 ||
        raw.masteryMilestones.length > 16
      )
        return fail();
      const players = new Set<number>();
      for (const milestone of raw.masteryMilestones) {
        if (
          !record(milestone) ||
          Object.keys(milestone).length !== 7 ||
          Object.keys(milestone).some(
            (key) =>
              ![
                "teamId",
                "pokemonId",
                "before",
                "after",
                "gained",
                "levelBefore",
                "levelAfter",
              ].includes(key),
          ) ||
          !integer(milestone.teamId, 0, rosters.length - 1) ||
          ![raw.homeTeamId, raw.awayTeamId].includes(milestone.teamId) ||
          !integer(milestone.pokemonId, 1, 1025) ||
          !rosters[milestone.teamId].includes(milestone.pokemonId) ||
          players.has(milestone.pokemonId) ||
          !xp(milestone.before) ||
          !xp(milestone.after) ||
          !xp(milestone.gained) ||
          milestone.gained <= 0 ||
          milestone.gained > masteryGameXpCap(courtVersion) ||
          milestone.after <= milestone.before ||
          Math.abs(milestone.after - milestone.before - milestone.gained) >
            1e-7 ||
          masteryLevel(milestone.before).name !== milestone.levelBefore ||
          masteryLevel(milestone.after).name !== milestone.levelAfter ||
          milestone.levelBefore === milestone.levelAfter
        )
          return fail();
        players.add(milestone.pokemonId);
      }
    }
    return structuredClone(raw) as unknown as LeagueGameSummary;
  });
}
