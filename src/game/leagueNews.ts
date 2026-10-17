import { POKEMON_BY_ID } from "../data/pokemon";
import { getCoach } from "./trainerCoaches";
import type {
  LeagueAward,
  LeagueGameSummary,
  LeaguePlayer,
  LeagueResult,
  LeagueTeam,
  Run,
  SeasonAward,
} from "./types";
import type { Franchise, FranchiseTrade } from "./franchiseTypes";
import type { DevelopmentRatings } from "./developmentTypes";
import type { MasteryTrainingChange } from "./abilityMastery";
import type { CoachChange } from "./coachOffice";
import type { LocalLeague } from "./localLeague";
import type { Playoffs } from "./playoffTypes";

export type LeagueNewsCategory =
  "games" | "development" | "transactions" | "honors";
export interface LeagueNewsStory {
  id: string;
  year: number;
  order: number;
  category: LeagueNewsCategory;
  headline: string;
  body: string;
  details: string[];
  source: string;
  teamIds: number[];
  pokemonIds: number[];
  gameId?: string;
}
/** Recorded facts only. Rendering this source never simulates or changes a season. */
export interface LeagueNewsSeason {
  year: number;
  teams: Pick<LeagueTeam, "id" | "name">[];
  games?: LeagueGameSummary[];
  players?: Pick<
    LeaguePlayer,
    "pokemonId" | "teamId" | "highPoints" | "gamesPlayed"
  >[];
  awards?: (SeasonAward & { teamId: number })[];
  championId?: number | null;
  finalsMvp?: { pokemonId: number; teamId: number; value: string } | null;
  development?: {
    pokemonId: number;
    teamId: number;
    before?: number;
    after?: number;
    outcome?: string;
    changes: DevelopmentRatings;
  }[];
  mastery?: MasteryTrainingChange[];
  trades?: Pick<
    FranchiseTrade,
    | "year"
    | "teamId"
    | "fromTeamId"
    | "giveId"
    | "receiveId"
    | "giveIds"
    | "receiveIds"
  >[];
  picks?: {
    pick: number;
    teamId: number;
    pokemonId: number;
    releasedId: number;
  }[];
  signings?: { teamId: number; pokemonId: number; releasedId: number }[];
  coaching?: CoachChange[];
}
const player = (id: number) => POKEMON_BY_ID.get(id)?.name ?? `Pokémon #${id}`;
const coach = (id: string | null) =>
  id ? (getCoach(id)?.name ?? id) : "Vacant position";
const xp = (n: number) => n.toFixed(2);
const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`;
const skill = (s: string) => s.replace(/([A-Z])/g, " $1").toLowerCase();
const unique = (ids: number[]) => [...new Set(ids)];

export function buildLeagueNews(
  seasons: LeagueNewsSeason[],
): LeagueNewsStory[] {
  const stories = new Map<string, LeagueNewsStory>();
  for (const season of seasons) {
    const { year } = season;
    const team = (id: number) =>
      season.teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
    const add = (
      key: string,
      category: LeagueNewsCategory,
      headline: string,
      body: string,
      teamIds: number[],
      pokemonIds: number[],
      source: string,
      order: number,
      details: string[] = [],
      gameId?: string,
    ) => {
      const id = `${year}:${key}`;
      stories.set(id, {
        id,
        year,
        category,
        headline,
        body,
        teamIds: unique(teamIds),
        pokemonIds: unique(pokemonIds),
        source: `Year ${year} · ${source}`,
        order,
        details,
        ...(gameId ? { gameId } : {}),
      });
    };
    const games = [
      ...new Map((season.games ?? []).map((g) => [g.id, g])).values(),
    ].sort((a, b) => a.round - b.round || a.id.localeCompare(b.id));
    const weeks = new Map<string, LeagueGameSummary[]>();
    for (const game of games) {
      // Playoff fixture IDs are kept as individual results; regular rounds form seven-round recaps.
      const playoff =
        /^p\d+-r/.test(game.id) ||
        game.id.startsWith("po-") ||
        game.id.startsWith("playoff");
      const gameOrder = (playoff ? 800 : 0) + game.round;
      const week = Math.floor(game.round / 7) + 1;
      if (!playoff)
        for (const id of [game.homeTeamId, game.awayTeamId]) {
          const key = `${week}:${id}`;
          weeks.set(key, [...(weeks.get(key) ?? []), game]);
        }
      const homeWon = game.homeScore > game.awayScore;
      const winner = homeWon ? game.homeTeamId : game.awayTeamId;
      const loser = homeWon ? game.awayTeamId : game.homeTeamId;
      const score = homeWon
        ? `${game.homeScore}–${game.awayScore}`
        : `${game.awayScore}–${game.homeScore}`;
      const margin = Math.abs(game.homeScore - game.awayScore);
      if (playoff || margin >= 25 || margin <= 3 || game.overtimePeriods > 0) {
        add(
          `game:${game.id}`,
          "games",
          `${team(winner)} ${game.overtimePeriods ? "win in overtime" : margin <= 3 ? "edge a close finish" : "record a win"}`,
          `${team(winner)} beat ${team(loser)} ${score}.`,
          [winner, loser],
          [],
          `${playoff ? "Playoffs" : `Round ${game.round + 1}`} · Game ${game.id}`,
          gameOrder,
          [
            `Final score: ${team(game.homeTeamId)} ${game.homeScore}, ${team(game.awayTeamId)} ${game.awayScore}.`,
            `Overtime periods: ${game.overtimePeriods}.`,
          ],
          game.id,
        );
      }
      for (const row of game.masteryMilestones ?? [])
        add(
          `mastery:game:${game.id}:${row.teamId}:${row.pokemonId}`,
          "development",
          `${player(row.pokemonId)} reaches ${row.levelAfter}`,
          `${team(row.teamId)} · Ability mastery ${xp(row.before)} → ${xp(row.after)} XP.`,
          [row.teamId],
          [row.pokemonId],
          `Recorded game mastery milestone · ${game.id}`,
          gameOrder + 0.1,
          [`${row.levelBefore} → ${row.levelAfter}.`],
          game.id,
        );
    }
    for (const [key, recorded] of weeks) {
      const [week, id] = key.split(":").map(Number);
      const wins = recorded.filter((g) =>
        g.homeTeamId === id
          ? g.homeScore > g.awayScore
          : g.awayScore > g.homeScore,
      ).length;
      const details = recorded.map((g) => {
        const home = g.homeTeamId === id;
        return `${team(id)} ${home ? g.homeScore : g.awayScore}–${home ? g.awayScore : g.homeScore} ${team(home ? g.awayTeamId : g.homeTeamId)}`;
      });
      add(
        `week:${week}:${id}`,
        "games",
        `${team(id)} · Week ${week} recap`,
        `${wins}–${recorded.length - wins} across ${recorded.length} recorded games.`,
        [id],
        [],
        `Regular-season rounds ${Math.min(...recorded.map((g) => g.round)) + 1}–${Math.max(...recorded.map((g) => g.round)) + 1} · recorded results`,
        Math.max(...recorded.map((g) => g.round)) + 0.2,
        details,
      );
    }
    for (const row of season.players ?? [])
      if (row.highPoints >= 40)
        add(
          `performance:${row.teamId}:${row.pokemonId}`,
          "games",
          `${player(row.pokemonId)} posts a ${row.highPoints}-point season high`,
          `${team(row.teamId)} · ${row.highPoints}-point season high across ${row.gamesPlayed} recorded games.`,
          [row.teamId],
          [row.pokemonId],
          "Recorded player season totals",
          500,
          [
            "The saved season totals do not identify the game in which this high was recorded.",
          ],
        );
    for (const row of season.development ?? []) {
      const changed = Object.entries(row.changes).filter(([, n]) => n !== 0);
      if (!changed.length) continue;
      const meaningful =
        row.before !== undefined && row.after !== undefined
          ? Math.abs(row.after - row.before) >= 0.5
          : changed.some(([, n]) => Math.abs(n!) >= 2);
      if (!meaningful && row.outcome !== "breakout" && row.outcome !== "slump")
        continue;
      add(
        `development:${row.teamId}:${row.pokemonId}`,
        "development",
        `${player(row.pokemonId)} · ${row.outcome ?? "offseason development"}`,
        `${team(row.teamId)}${row.before !== undefined && row.after !== undefined ? ` · Best-position rating ${row.before.toFixed(1)} → ${row.after.toFixed(1)}.` : " · Recorded offseason skill changes."}`,
        [row.teamId],
        [row.pokemonId],
        "Saved offseason development report",
        1100,
        changed.map(([key, n]) => `${skill(key)} ${signed(n!)} rating points.`),
      );
    }
    for (const row of season.mastery ?? [])
      if (row.gained > 0)
        add(
          `mastery:training:${row.teamId}:${row.pokemonId}`,
          "development",
          `${player(row.pokemonId)} ${row.levelBefore !== row.levelAfter ? `reaches ${row.levelAfter}` : row.breakthrough ? "records a training breakthrough" : "builds ability mastery"}`,
          `${team(row.teamId)} · ${xp(row.before)} → ${xp(row.after)} XP (+${xp(row.gained)}).`,
          [row.teamId],
          [row.pokemonId],
          "Saved offseason mastery training report",
          1101,
          [
            `Completed focus: ${row.focus}.`,
            `${row.levelBefore} → ${row.levelAfter}.`,
            ...row.reasons,
          ],
        );
    (season.trades ?? []).forEach((row, i) => {
      const from = row.fromTeamId ?? 0,
        give = row.giveIds ?? [row.giveId],
        receive = row.receiveIds ?? [row.receiveId];
      add(
        `trade:${i}`,
        "transactions",
        `${team(from)} and ${team(row.teamId)} complete a trade`,
        `${team(from)} sent ${give.map(player).join(", ")} to ${team(row.teamId)}; ${team(row.teamId)} sent ${receive.map(player).join(", ")} to ${team(from)}.`,
        [from, row.teamId],
        [...give, ...receive],
        `Saved trade ledger · transaction ${i + 1}`,
        1200 + i / 1000,
      );
    });
    for (const row of season.picks ?? [])
      add(
        `pick:${row.pick}`,
        "transactions",
        `${team(row.teamId)} draft ${player(row.pokemonId)}`,
        `Pick ${row.pick}: ${team(row.teamId)} selected ${player(row.pokemonId)} and released ${player(row.releasedId)}.`,
        [row.teamId],
        [row.pokemonId, row.releasedId],
        "Saved rookie draft",
        1300 + row.pick / 1000,
      );
    (season.signings ?? []).forEach((row, i) =>
      add(
        `signing:${i}`,
        "transactions",
        `${player(row.pokemonId)} joins ${team(row.teamId)}`,
        `${team(row.teamId)} signed ${player(row.pokemonId)} and released ${player(row.releasedId)}.`,
        [row.teamId],
        [row.pokemonId, row.releasedId],
        `Saved free-agency ledger · signing ${i + 1}`,
        1400 + i / 1000,
      ),
    );
    (season.coaching ?? []).forEach((row, i) =>
      add(
        `coach:${i}`,
        "honors",
        `${team(row.teamId)} ${row.to ? `appoint ${coach(row.to)}` : "open their coaching position"}`,
        `${coach(row.from)} → ${coach(row.to)}.`,
        [row.teamId],
        [],
        `Saved coaching office · change ${i + 1}`,
        1450 + i / 1000,
      ),
    );
    for (const award of season.awards ?? [])
      add(
        `award:${award.id}`,
        "honors",
        `${player(award.pokemonId)} wins ${award.title}`,
        `${team(award.teamId)} · ${award.value}.`,
        [award.teamId],
        [award.pokemonId],
        "Recorded season awards",
        900,
        [award.description],
      );
    if (season.championId != null)
      add(
        "champion",
        "honors",
        `${team(season.championId)} win the championship`,
        `${team(season.championId)} are the recorded Year ${year} champions.`,
        [season.championId],
        [],
        "Completed championship record",
        1000,
      );
    if (season.finalsMvp) {
      const row = season.finalsMvp;
      add(
        "finals-mvp",
        "honors",
        `${player(row.pokemonId)} wins Finals MVP`,
        `${team(row.teamId)} · ${row.value}.`,
        [row.teamId],
        [row.pokemonId],
        "Recorded Finals MVP",
        1001,
      );
    }
  }
  return [...stories.values()].sort(
    (a, b) => b.year - a.year || b.order - a.order || a.id.localeCompare(b.id),
  );
}

export function franchiseNewsSources(
  franchise: Franchise,
  run: Run,
): LeagueNewsSeason[] {
  const sources: LeagueNewsSeason[] = franchise.history.map((h) => ({
    year: h.year,
    teams: h.replay?.teams ?? franchise.teams,
    games: h.newsGames,
    players: h.replay?.regularPlayers,
    awards: h.awards,
    championId: h.championId,
    finalsMvp: h.finalsMvp,
  }));
  const league = run.result?.league ?? run.seasonProgress?.result?.league;
  if (franchise.phase === "season" && league)
    sources.push({
      year: franchise.year,
      teams: league.teams,
      games: [
        ...league.games,
        ...(run.playoffs?.series.flatMap((s) => s.games) ?? []),
      ],
      players: league.players,
      awards: league.awards,
      championId: run.playoffs?.championId,
      finalsMvp: run.playoffs?.finalsMvp,
    });
  const years = unique([
    franchise.year,
    ...franchise.history.map((h) => h.year),
    ...(franchise.offseasons ?? []).map((r) => r.year),
  ]);
  for (const year of years)
    sources.push({
      year,
      teams:
        franchise.history.find((h) => h.year === year)?.replay?.teams ??
        franchise.teams,
      development: franchise.offseasons?.find((r) => r.year === year)?.players,
      mastery: franchise.offseasons?.find((r) => r.year === year)?.mastery,
      trades: franchise.trades.filter((t) => t.year === year),
      picks: franchise.rookieDrafts?.find((d) => d.year === year)?.picks,
      signings: franchise.freeAgency?.transactions.filter(
        (t) => t.year === year,
      ),
      coaching: franchise.coachOffice?.years.find((r) => r.year === year)
        ?.changes,
    });
  return sources;
}
export function localNewsSources(
  draft: LocalLeague,
  league?: LeagueResult | null,
  playoffs?: Playoffs | null,
): LeagueNewsSeason[] {
  const sources: LeagueNewsSeason[] = (draft.career?.history ?? []).map(
    (h) => ({
      year: h.year,
      teams: h.teams,
      games: h.newsGames,
      players: h.newsPlayers,
      awards: h.awards as LeagueAward[],
      championId: h.championId,
      finalsMvp: h.finalsMvp,
      development: h.development,
      mastery: h.mastery,
      trades: h.trades.map((t) => ({ ...t, year: h.year })),
      picks: h.rookiePicks.map((p, i) => ({ ...p, pick: i + 1 })),
      coaching: draft.career?.coachOffice?.years.find((r) => r.year === h.year)
        ?.changes,
    }),
  );
  if (draft.career?.phase !== "offseason" && league)
    sources.push({
      year: draft.career?.year ?? 1,
      teams: league.teams,
      games: [
        ...league.games,
        ...(playoffs?.series.flatMap((s) => s.games) ?? []),
      ],
      players: league.players,
      awards: league.awards,
      championId: playoffs?.championId,
      finalsMvp: playoffs?.finalsMvp,
    });
  return sources;
}
