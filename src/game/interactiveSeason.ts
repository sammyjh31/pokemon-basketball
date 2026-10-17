import { snapshotChemistry, teamsWithChemistry } from "./teammateChemistry";
import type { OfficialGame } from "./franchiseFeatures";
import { leagueSchedule } from "./league";
import { validateOfficialGame } from "./officialGame";
import { seasonBuilder, seasonTeams } from "./season";
import type { LeagueFixture, Run, SeasonResult } from "./types";

export function nextFranchiseFixture(run: Run): LeagueFixture | null {
  if (run.result) return null;
  if (run.seasonProgress && run.seasonProgress.modelVersion !== 1)
    throw new Error("Unsupported season progress.");
  const completed = run.seasonProgress?.completedRounds ?? 0;
  if (!Number.isInteger(completed) || completed < 0 || completed > 82)
    throw new Error("Invalid season progress.");
  const fixture =
    leagueSchedule(run.seasonSeed)
      .slice(completed * 15, (completed + 1) * 15)
      .find((f) => f.homeTeamId === 0 || f.awayTeamId === 0) ?? null;
  if (!fixture || run.chemistryGrowthVersion !== 1) return fixture;
  const latest =
    run.seasonProgress?.result ??
    (completed
      ? replaySeasonProgress(
          run,
          completed,
          run.seasonProgress?.playedGames ?? {},
        )
      : undefined);
  const teams = teamsWithChemistry(
    seasonTeams(run),
    latest?.league?.chemistryBonds,
  );
  const chemistry = snapshotChemistry(
    teams[fixture.homeTeamId],
    teams[fixture.awayTeamId],
  );
  return { ...fixture, ...(chemistry ? { chemistry } : {}) };
}

export function replaySeasonProgress(
  run: Run,
  completedRounds: number,
  playedGames: Record<string, OfficialGame>,
): SeasonResult {
  const replay: Run = {
    ...run,
    leagueTeams: seasonTeams(run),
    result: null,
    seasonProgress: { modelVersion: 1, completedRounds, playedGames },
  };
  const season = seasonBuilder(replay, completedRounds, playedGames);
  season.fixtures.forEach(season.play);
  return season.finish();
}

/** Replay the bounded prefix, append whole league rounds, then publish one immutable result. */
export async function advanceFranchiseSeasonAsync(
  run: Run,
  rounds: number,
  onProgress: (completed: number, total: number) => void = () => {},
  signal?: AbortSignal,
  played?: OfficialGame,
): Promise<Run> {
  signal?.throwIfAborted();
  if (run.result || !Number.isInteger(rounds) || rounds < 1 || rounds > 82)
    throw new Error("Choose a pending season round.");
  if (run.seasonProgress && run.seasonProgress.modelVersion !== 1)
    throw new Error("Unsupported season progress.");
  const completed = run.seasonProgress?.completedRounds ?? 0;
  if (!Number.isInteger(completed) || completed < 0 || completed >= 82)
    throw new Error("Invalid season progress.");
  if (played && rounds !== 1)
    throw new Error("An official game advances exactly one league round.");
  const teams = seasonTeams(run),
    target = Math.min(82, completed + rounds);
  const playedGames = structuredClone(run.seasonProgress?.playedGames ?? {});
  // Validate saved overrides against the old prefix before accepting the next round.
  seasonBuilder({ ...run, result: null }, completed, playedGames);
  if (played) {
    const fixture = nextFranchiseFixture(run);
    if (!fixture || playedGames[fixture.id])
      throw new Error("This official fixture has already been recorded.");
    playedGames[fixture.id] = validateOfficialGame(played, fixture, teams);
  }
  const next: Run = {
    ...run,
    leagueTeams: teams,
    seasonProgress: { modelVersion: 1, completedRounds: target, playedGames },
    result: null,
  };
  const season = seasonBuilder(next, target, playedGames);
  onProgress(0, target * 15);
  for (let i = 0; i < season.fixtures.length; i += 15) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    season.fixtures.slice(i, i + 15).forEach(season.play);
    onProgress(
      Math.min(i + 15, season.fixtures.length),
      season.fixtures.length,
    );
  }
  signal?.throwIfAborted();
  const result = season.finish();
  if (target === 82) next.result = result;
  else next.seasonProgress!.result = result;
  return next;
}
