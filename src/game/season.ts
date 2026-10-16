import { recordScouting, scoutingForMatch } from "./opponentScouting";
import type { ScoutingMemory, MatchScouting } from "./typeTacticsTypes";
import { createLeague, leagueSchedule } from "./league";
import { simulateMatch } from "./match";
import { validateOfficialGame } from "./officialGame";
import type { OfficialGame } from "./franchiseFeatures";
import { addBox, leagueHonors, leaguePlayers } from "./leagueStats";
import { validateLeagueTeams } from "./franchiseValidation";
import { teamRatings } from "./ratings";
import type {
  GameResult,
  LeagueFixture,
  LeagueGameSummary,
  Run,
  SeasonResult,
  Standing,
  LeagueTeam,
} from "./types";
export { resolveScore, winProbability, SEASON_RULES } from "./v2Season";
export function seasonTeams(run: Run): LeagueTeam[] {
  if (run.coachDraftRequired)
    throw new Error("Choose your trainer coach first.");
  if (!run.leagueTeams && !run.rotationPlan) return createLeague(run);
  const teams = run.leagueTeams
    ? validateLeagueTeams(
        run.leagueTeams,
        run.includeLegends,
        run.simulationVersion,
      )
    : createLeague(run);
  if (run.seasonProgress && run.seasonProgress.completedRounds > 0)
    return teams;
  const members = new Set(Object.values(teams[0].roster));
  const chosen = Object.values(run.roster);
  if (
    chosen.length !== 8 ||
    new Set(chosen).size !== 8 ||
    chosen.some((id) => !members.has(id))
  )
    throw new Error(
      "Franchise rosters can change only through offseason trades.",
    );
  teams[0] = {
    ...teams[0],
    ...(run.coach ? { coach: run.coach } : {}),
    roster: { ...run.roster },
    tactic: run.tactic,
    rotation: run.rotation,
    defense: run.defense ?? "man",
    ...(run.rotationPlan
      ? { rotationPlan: structuredClone(run.rotationPlan) }
      : {}),
    ratings: teamRatings(
      run.roster,
      run.tactic,
      run.rotation,
      teams[0].development,
      run.rotationPlan,
    ),
  };
  if (!run.rotationPlan) delete teams[0].rotationPlan;
  return teams;
}
export function seasonBuilder(
  run: Run,
  completedRounds = 82,
  playedGames: Record<string, OfficialGame> = run.seasonProgress?.playedGames ??
    {},
) {
  if (
    !Number.isInteger(completedRounds) ||
    completedRounds < 0 ||
    completedRounds > 82 ||
    !playedGames ||
    typeof playedGames !== "object" ||
    Array.isArray(playedGames)
  )
    throw new Error("Invalid season progress.");
  if (run.result) throw new Error("This roster has already played its season.");
  const teams = seasonTeams(run),
    fixtures = leagueSchedule(run.seasonSeed),
    players = leaguePlayers(teams);
  const eligible = new Map(
    fixtures.slice(0, completedRounds * 15).map((f) => [f.id, f]),
  );
  for (const [id, game] of Object.entries(playedGames)) {
    const fixture = eligible.get(id);
    if (!fixture)
      throw new Error("Official game is outside the completed season prefix.");
    validateOfficialGame(game, fixture, teams);
  }
  const byPlayer = new Map(players.map((p) => [p.playerId, p]));
  const standings: Standing[] = teams.map((t) => ({
    teamId: t.id,
    wins: 0,
    losses: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    homeWins: 0,
    awayWins: 0,
    streak: 0,
    lastTen: 0,
  }));
  const history = teams.map(() => [] as boolean[]),
    games: GameResult[] = [],
    summaries: LeagueGameSummary[] = [];
  const scouting: ScoutingMemory | undefined =
    teams[0].typeTacticsVersion === 1 ? {} : undefined;
  const play = (fixture: LeagueFixture) => {
    const { homeTeamId: h, awayTeamId: a } = fixture;
    const context = scouting ? scoutingForMatch(scouting, h, a) : undefined;
    const match = resolveSeasonMatch(
      { ...fixture, ...(context ? { scouting: context } : {}) },
      teams,
      playedGames,
    );
    if (scouting) recordScouting(scouting, teams[h], teams[a], match);
    summaries.push({
      ...fixture,
      ...(context ? { scouting: context } : {}),
      homeScore: match.homeScore,
      awayScore: match.awayScore,
      overtimePeriods: match.overtimePeriods,
    });
    for (const box of [...match.homeBox, ...match.awayBox])
      addBox(byPlayer.get(box.playerId)!, box, match.playerOfGameId);
    for (const [id, score, against, home] of [
      [h, match.homeScore, match.awayScore, true],
      [a, match.awayScore, match.homeScore, false],
    ] as const) {
      const row = standings[id],
        won = score > against;
      row.wins += Number(won);
      row.losses += Number(!won);
      row.pointsFor += score;
      row.pointsAgainst += against;
      row.homeWins += Number(home && won);
      row.awayWins += Number(!home && won);
      row.streak = won
        ? row.streak > 0
          ? row.streak + 1
          : 1
        : row.streak < 0
          ? row.streak - 1
          : -1;
      history[id].push(won);
      row.lastTen = history[id].slice(-10).filter(Boolean).length;
    }
    if (h === 0 || a === 0) {
      const home = h === 0,
        teamScore = home ? match.homeScore : match.awayScore,
        opponentScore = home ? match.awayScore : match.homeScore;
      const winner = byPlayer.get(match.playerOfGameId)!;
      games.push({
        index: games.length,
        opponentId: home ? a : h,
        home,
        winProbability: 0.5,
        teamScore,
        opponentScore,
        won: teamScore > opponentScore,
        overtime: match.overtimePeriods > 0,
        overtimePeriods: match.overtimePeriods,
        possessions: match.possessions,
        playerOfGameId: winner.pokemonId,
        playerOfGameTeamId: winner.teamId,
        leagueGameId: fixture.id,
        boxScore: home ? match.homeBox : match.awayBox,
        opponentBoxScore: home ? match.awayBox : match.homeBox,
      });
    }
  };
  const finish = (): SeasonResult => {
    const honors =
        completedRounds === 82
          ? leagueHonors(players, standings)
          : { awards: [], allLeague: [], allDefense: [] },
      mvp = honors.awards.find((a) => a.id === "mvp");
    return {
      modelVersion:
        run.seasonProgress ||
        run.rotationPlan ||
        teams.some((team) => team.rotationPlan)
          ? 6
          : run.leagueTeams
            ? teams.some((team) => team.development !== undefined)
              ? 5
              : 4
            : 3,
      games,
      wins: standings[0].wins,
      losses: standings[0].losses,
      mvpId: mvp?.pokemonId ?? 0,
      mvpTeamId: mvp?.teamId ?? 0,
      playerStats: players.filter((p) => p.teamId === 0),
      awards: honors.awards,
      league: {
        teams,
        games: summaries,
        players,
        standings,
        ...honors,
        ...(scouting ? { scouting } : {}),
      },
    };
  };
  return { fixtures: fixtures.slice(0, completedRounds * 15), play, finish };
}
export function simulateSeason(run: Run): SeasonResult {
  const season = seasonBuilder(run);
  season.fixtures.forEach(season.play);
  return season.finish();
}
export async function simulateSeasonAsync(
  run: Run,
  onProgress: (completed: number, total: number) => void = () => {},
  signal?: AbortSignal,
): Promise<SeasonResult> {
  signal?.throwIfAborted();
  const season = seasonBuilder(run);
  onProgress(0, season.fixtures.length);
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
  return season.finish();
}

/** Resolve an archived or current fixture without replacing an authoritative played result. */
export function resolveSeasonMatch(
  fixture: LeagueFixture & { scouting?: MatchScouting },
  teams: LeagueTeam[],
  playedGames: Record<string, OfficialGame> = {},
) {
  if (playedGames[fixture.id])
    return validateOfficialGame(playedGames[fixture.id], fixture, teams).match;
  const home = teams.find((team) => team.id === fixture.homeTeamId),
    away = teams.find((team) => team.id === fixture.awayTeamId);
  if (!home || !away) throw new Error("Missing fixture team.");
  return simulateMatch(home, away, fixture.seed, {
    scouting: fixture.scouting,
  });
}
