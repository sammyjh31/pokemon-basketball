import { recordScouting, emptyScouting } from "./opponentScouting";
import { resolvePlayoffMatch } from "./playoffs";
import { compactScouting } from "./scoutingContinuity";
import type { CoachBook } from "./scoutingContinuityTypes";
import type { LeagueResult } from "./types";
import type { Playoffs } from "./playoffTypes";
/** Reuse final regular-season observations and resolve only the last game of finished playoff series. */
export function captureCoachBook(
  league: LeagueResult,
  playoffs: Playoffs,
  year: number,
): CoachBook | undefined {
  if (
    !league.scouting ||
    !league.teams.every(
      (t) => t.movesetVersion === 3 && t.typeTacticsVersion === 1,
    )
  )
    return;
  const memory = { ...league.scouting },
    seen = new Set<string>();
  for (const game of [
    ...league.games,
    ...playoffs.series.flatMap((s) => s.games),
  ]) {
    seen.add(`${game.homeTeamId}:${game.awayTeamId}`);
    seen.add(`${game.awayTeamId}:${game.homeTeamId}`);
  }
  for (const series of playoffs.series) {
    const game = series.games.at(-1);
    if (series.winnerId === null || !game) continue;
    const home = league.teams.find((t) => t.id === game.homeTeamId)!,
      away = league.teams.find((t) => t.id === game.awayTeamId)!;
    if (game.scouting) {
      memory[`${home.id}:${away.id}`] = game.scouting.home;
      memory[`${away.id}:${home.id}`] = game.scouting.away;
    }
    recordScouting(
      memory,
      home,
      away,
      resolvePlayoffMatch(game, league.teams, playoffs.playedGames),
    );
  }
  const book: CoachBook = {
    version: 1,
    year,
    teams: league.teams.map((team) => ({
      id: team.id,
      roster: Object.values(team.roster) as number[],
      ...(team.coach ? { coachId: team.coach.id } : {}),
    })),
    coaches: {},
  };
  for (const team of league.teams)
    if (team.coach) {
      const opponents: CoachBook["coaches"][string]["opponents"] = {};
      for (const opponent of league.teams)
        if (
          opponent.id !== team.id &&
          seen.has(`${team.id}:${opponent.id}`) &&
          memory[`${team.id}:${opponent.id}`]?.games
        )
          opponents[opponent.id] = compactScouting(
            memory[`${team.id}:${opponent.id}`],
          );
      const selfPlayers: import("./typeTacticsTypes").OpponentScouting["players"] =
        {};
      for (const p of league.players)
        if (p.teamId === team.id && p.fga > 0)
          selfPlayers[p.pokemonId] = {
            attempts: p.fga,
            points: 2 * p.fgm + p.threePM,
            rimAttempts: p.rimFga,
            threeAttempts: p.threePA,
          };
      book.coaches[team.coach.id] = {
        teamId: team.id,
        selfPlayers: compactScouting({
          ...emptyScouting(),
          players: selfPlayers,
        }).players,
        opponents,
      };
    }
  return book;
}
