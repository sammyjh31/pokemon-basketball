import { createLeague, leagueSchedule } from "./league";
import { simulateMatch } from "./match";
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
  if (!run.leagueTeams) return createLeague(run);
  const teams = validateLeagueTeams(run.leagueTeams, run.includeLegends);
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
    roster: { ...run.roster },
    tactic: run.tactic,
    rotation: run.rotation,
    defense: run.defense ?? "man",
    ratings: teamRatings(run.roster, run.tactic, run.rotation),
  };
  return teams;
}
function seasonBuilder(run: Run) {
  if (run.result) throw new Error("This roster has already played its season.");
  const teams = seasonTeams(run),
    fixtures = leagueSchedule(run.seasonSeed),
    players = leaguePlayers(teams);
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
  const play = (fixture: LeagueFixture) => {
    const { homeTeamId: h, awayTeamId: a } = fixture,
      match = simulateMatch(teams[h], teams[a], fixture.seed);
    summaries.push({
      ...fixture,
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
    const honors = leagueHonors(players, standings),
      mvp = honors.awards.find((a) => a.id === "mvp")!;
    return {
      modelVersion: run.leagueTeams ? 4 : 3,
      games,
      wins: standings[0].wins,
      losses: standings[0].losses,
      mvpId: mvp.pokemonId,
      mvpTeamId: mvp.teamId,
      playerStats: players.filter((p) => p.teamId === 0),
      awards: honors.awards,
      league: { teams, games: summaries, players, standings, ...honors },
    };
  };
  return { fixtures, play, finish };
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
