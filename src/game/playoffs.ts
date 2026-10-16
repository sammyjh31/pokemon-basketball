import { addBox, leaguePlayers, playerImpact } from "./leagueStats";
import { simulateMatch } from "./match";
import { nextRandom } from "./random";
import type {
  LeagueFixture,
  LeaguePlayer,
  LeagueResult,
  LeagueTeam,
} from "./types";
import type { OfficialGame } from "./franchiseFeatures";
import { validateOfficialGame } from "./officialGame";
import type {
  PlayoffMode,
  PlayoffRound,
  Playoffs,
  PlayoffSeries,
} from "./playoffTypes";

export const PLAYOFF_ROUND_LABELS = [
  "First round",
  "Quarterfinals",
  "Semifinals",
  "Finals",
] as const;
const FIRST_ROUND = [
  [1, 16],
  [8, 9],
  [4, 13],
  [5, 12],
  [2, 15],
  [7, 10],
  [3, 14],
  [6, 11],
];
const HOME_PATTERN = [true, true, false, false, true, false, true];

/** An additive model: do not change these rules without versioning saved playoffs. */
export function createPlayoffs(
  league: LeagueResult,
  _seasonSeed: number,
): Playoffs {
  if (
    league.teams.length !== 30 ||
    league.standings.length !== 30 ||
    new Set(league.teams.map((t) => t.id)).size !== 30 ||
    new Set(league.standings.map((s) => s.teamId)).size !== 30 ||
    league.standings.some(
      (s) =>
        !league.teams.some((t) => t.id === s.teamId) ||
        !Number.isInteger(s.wins) ||
        !Number.isInteger(s.losses) ||
        s.wins < 0 ||
        s.losses < 0 ||
        s.wins + s.losses !== 82,
    )
  )
    throw new Error("Finish the full regular season before starting playoffs.");
  const seeds = [...league.standings]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
        a.teamId - b.teamId,
    )
    .slice(0, 16)
    .map((s, i) => ({
      seed: i + 1,
      teamId: s.teamId,
      wins: s.wins,
      losses: s.losses,
    }));
  const series: PlayoffSeries[] = [];
  for (let round = 0; round < 4; round++)
    for (let index = 0; index < 8 / 2 ** round; index++) {
      const pair = round === 0 ? FIRST_ROUND[index] : null;
      series.push({
        id: `p1-r${round + 1}-s${index + 1}`,
        round: round as PlayoffRound,
        index,
        higherSeedId: pair ? seeds[pair[0] - 1].teamId : null,
        lowerSeedId: pair ? seeds[pair[1] - 1].teamId : null,
        higherSeedWins: 0,
        lowerSeedWins: 0,
        winnerId: null,
        games: [],
      });
    }
  return {
    modelVersion: 1,
    seeds,
    series,
    players: leaguePlayers(
      seeds.map((s) => league.teams.find((t) => t.id === s.teamId)!),
    ),
    finalsPlayers: [],
    championId: null,
    finalsMvp: null,
  };
}

export const playoffGameCount = (playoffs: Playoffs) =>
  playoffs.series.reduce((total, s) => total + s.games.length, 0);

function activeRound(playoffs: Playoffs) {
  return playoffs.series.find((s) => s.winnerId === null)?.round;
}

function advanceWinners(playoffs: Playoffs, teams: LeagueTeam[]) {
  const seedOf = (id: number) =>
    playoffs.seeds.find((s) => s.teamId === id)!.seed;
  for (const series of playoffs.series) {
    if (series.round === 0 || series.higherSeedId !== null) continue;
    const feeders = playoffs.series
      .filter((s) => s.round === series.round - 1)
      .slice(series.index * 2, series.index * 2 + 2);
    if (feeders.some((s) => s.winnerId === null)) continue;
    const ids = feeders
      .map((s) => s.winnerId!)
      .sort((a, b) => seedOf(a) - seedOf(b));
    [series.higherSeedId, series.lowerSeedId] = ids;
    if (series.round === 3)
      playoffs.finalsPlayers = leaguePlayers(
        ids.map((id) => teams.find((t) => t.id === id)!),
      );
  }
  const finals = playoffs.series.find((s) => s.round === 3)!;
  if (finals.winnerId === null) return;
  playoffs.championId = finals.winnerId;
  playoffs.finalsMvp = selectFinalsMvp(playoffs.finalsPlayers, finals.winnerId);
}

export function selectFinalsMvp(players: LeaguePlayer[], championId: number) {
  const score = (p: LeaguePlayer) => playerImpact(p) * p.gamesPlayed;
  // Rank integer tenths so an exact statistical tie reaches the ID tiebreaker.
  const units = (p: LeaguePlayer) =>
    10 * p.points +
    12 * (p.offensiveRebounds + p.defensiveRebounds) +
    15 * p.assists +
    30 * p.steals +
    30 * p.blocks -
    15 * p.turnovers -
    4 * (p.fga - p.fgm) -
    4 * (p.fta - p.ftm);
  const mvp = [...players]
    .filter((p) => p.teamId === championId && p.gamesPlayed > 0)
    .sort((a, b) => units(b) - units(a) || a.pokemonId - b.pokemonId)[0];
  if (!mvp) return null;
  const pg = (n: number) => (n / mvp.gamesPlayed).toFixed(1);
  return {
    playerId: mvp.playerId,
    pokemonId: mvp.pokemonId,
    teamId: mvp.teamId,
    score: score(mvp),
    value: `${pg(mvp.points)} PPG · ${pg(mvp.offensiveRebounds + mvp.defensiveRebounds)} RPG · ${pg(mvp.assists)} APG`,
  };
}

function nextPlayoffFixture(playoffs: Playoffs, seasonSeed: number) {
  const round = activeRound(playoffs);
  if (round === undefined) return null;
  // Balanced slates: play at most one game per active series before its next game.
  const series = playoffs.series
    .filter((s) => s.round === round && s.winnerId === null)
    .sort((a, b) => a.games.length - b.games.length || a.index - b.index)[0];
  const gameIndex = series.games.length;
  if (
    series.higherSeedId === null ||
    series.lowerSeedId === null ||
    gameIndex >= 7
  )
    throw new Error("The playoff bracket cannot advance.");
  const homeId = HOME_PATTERN[gameIndex]
    ? series.higherSeedId
    : series.lowerSeedId;
  const awayId = HOME_PATTERN[gameIndex]
    ? series.lowerSeedId
    : series.higherSeedId;
  const gameSeed = nextRandom(
    (seasonSeed ^
      0x5a71c3e9 ^
      Math.imul(1 + round * 56 + series.index * 7 + gameIndex, 0x9e3779b1)) >>>
      0,
  ).seed;
  return {
    series,
    fixture: {
      id: `${series.id}-g${gameIndex + 1}`,
      round,
      homeTeamId: homeId,
      awayTeamId: awayId,
      seed: gameSeed,
    },
  };
}

export function resolvePlayoffMatch(
  fixture: LeagueFixture,
  teams: LeagueTeam[],
  playedGames: Record<string, OfficialGame> = {},
) {
  if (playedGames[fixture.id])
    return validateOfficialGame(playedGames[fixture.id], fixture, teams).match;
  const home = teams.find((t) => t.id === fixture.homeTeamId),
    away = teams.find((t) => t.id === fixture.awayTeamId);
  if (!home || !away) throw new Error("Missing playoff team.");
  return simulateMatch(home, away, fixture.seed);
}

function playOne(playoffs: Playoffs, league: LeagueResult, seasonSeed: number) {
  const next = nextPlayoffFixture(playoffs, seasonSeed);
  if (!next) return false;
  const { series, fixture } = next,
    { homeTeamId: homeId, awayTeamId: awayId, round } = fixture;
  const match = resolvePlayoffMatch(
    fixture,
    league.teams,
    playoffs.playedGames,
  );
  series.games.push({
    ...fixture,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    overtimePeriods: match.overtimePeriods,
  });
  const winnerId = match.homeScore > match.awayScore ? homeId : awayId;
  if (winnerId === series.higherSeedId) series.higherSeedWins++;
  else series.lowerSeedWins++;
  if (series.higherSeedWins === 4 || series.lowerSeedWins === 4)
    series.winnerId = winnerId;
  for (const box of [...match.homeBox, ...match.awayBox]) {
    addBox(
      playoffs.players.find((p) => p.playerId === box.playerId)!,
      box,
      match.playerOfGameId,
    );
    if (round === 3)
      addBox(
        playoffs.finalsPlayers.find((p) => p.playerId === box.playerId)!,
        box,
        match.playerOfGameId,
      );
  }
  advanceWinners(playoffs, league.teams);
  return true;
}

function progression(
  league: LeagueResult,
  seasonSeed: number,
  current: Playoffs | undefined,
  mode: PlayoffMode,
  overrides?: Record<string, OfficialGame>,
) {
  if (!["game", "round", "all"].includes(mode))
    throw new Error("Unknown playoff progression mode.");
  if (current && ![1, 2].includes(current.modelVersion))
    throw new Error("Unsupported playoff model.");
  const playoffs = current
    ? structuredClone(current)
    : createPlayoffs(league, seasonSeed);
  if (overrides) {
    const merged = { ...playoffs.playedGames };
    for (const [id, game] of Object.entries(overrides)) {
      if (merged[id] && JSON.stringify(merged[id]) !== JSON.stringify(game))
        throw new Error("Cannot replace an official playoff result.");
      if (
        !merged[id] &&
        playoffs.series.some((series) => series.games.some((f) => f.id === id))
      )
        throw new Error("Cannot replace a completed playoff fixture.");
      merged[id] = game;
    }
    if (Object.keys(merged).length) {
      playoffs.modelVersion = 2;
      playoffs.playedGames = structuredClone(merged);
    }
  }
  const round = activeRound(playoffs),
    initialCount = playoffGameCount(playoffs);
  const active = playoffs.series.filter(
    (s) => s.round === round && s.winnerId === null,
  );
  const targetGame = active.length
    ? Math.min(...active.map((s) => s.games.length)) + 1
    : 0;
  const remaining =
    mode === "game"
      ? active.filter((s) => s.games.length < targetGame).length
      : playoffs.series
          .filter(
            (s) => s.winnerId === null && (mode === "all" || s.round === round),
          )
          .reduce((n, s) => n + 7 - s.games.length, 0);
  const more = () =>
    playoffs.championId === null &&
    (mode === "all" ||
      (activeRound(playoffs) === round &&
        (mode === "round" ||
          playoffs.series.some(
            (s) =>
              s.round === round &&
              s.winnerId === null &&
              s.games.length < targetGame,
          ))));
  return { playoffs, initialCount, remaining, more };
}

export function simulatePlayoffs(
  league: LeagueResult,
  seasonSeed: number,
  current?: Playoffs,
  mode: PlayoffMode = "all",
  overrides?: Record<string, OfficialGame>,
): Playoffs {
  const job = progression(league, seasonSeed, current, mode, overrides);
  while (job.more()) playOne(job.playoffs, league, seasonSeed);
  assertPlayedPrefix(job.playoffs);
  return job.playoffs;
}

export async function simulatePlayoffsAsync(
  league: LeagueResult,
  seasonSeed: number,
  current: Playoffs | undefined,
  mode: PlayoffMode,
  onProgress: (completed: number, total: number) => void = () => {},
  signal?: AbortSignal,
  overrides?: Record<string, OfficialGame>,
): Promise<Playoffs> {
  signal?.throwIfAborted();
  const job = progression(league, seasonSeed, current, mode, overrides);
  onProgress(0, job.remaining);
  while (job.more()) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    playOne(job.playoffs, league, seasonSeed);
    onProgress(
      playoffGameCount(job.playoffs) - job.initialCount,
      job.remaining,
    );
  }
  signal?.throwIfAborted();
  const completed = playoffGameCount(job.playoffs) - job.initialCount;
  onProgress(completed, completed);
  assertPlayedPrefix(job.playoffs);
  return job.playoffs;
}

/** Reconstruct only a bounded prefix. Never trust saved seeds, results or aggregates. */
export function replayPlayoffs(
  league: LeagueResult,
  seasonSeed: number,
  gameCount: number,
  playedGames: Record<string, OfficialGame> = {},
): Playoffs {
  if (!Number.isInteger(gameCount) || gameCount < 0 || gameCount > 105)
    throw new Error("Invalid playoff game count.");
  if (
    !playedGames ||
    typeof playedGames !== "object" ||
    Array.isArray(playedGames) ||
    Object.keys(playedGames).length > 28
  )
    throw new Error("Invalid official playoff results.");
  const playoffs = createPlayoffs(league, seasonSeed);
  if (Object.keys(playedGames).length) {
    playoffs.modelVersion = 2;
    playoffs.playedGames = structuredClone(playedGames);
  }
  for (let i = 0; i < gameCount; i++)
    if (!playOne(playoffs, league, seasonSeed))
      throw new Error("The saved playoffs continue after the championship.");
  assertPlayedPrefix(playoffs);
  return playoffs;
}

function projectUserFixture(
  league: LeagueResult,
  seed: number,
  current?: Playoffs,
) {
  const playoffs = current
    ? replayPlayoffs(
        league,
        seed,
        playoffGameCount(current),
        current.playedGames,
      )
    : createPlayoffs(league, seed);
  if (!playoffs.seeds.some((s) => s.teamId === 0))
    return { playoffs, fixture: null };
  for (let i = 0; i <= 105; i++) {
    const next = nextPlayoffFixture(playoffs, seed);
    if (!next) return { playoffs, fixture: null };
    if ([next.fixture.homeTeamId, next.fixture.awayTeamId].includes(0))
      return { playoffs, fixture: next.fixture };
    playOne(playoffs, league, seed);
  }
  throw new Error("Invalid playoff progression.");
}

/** CPU fixtures before the next coach fixture are projected deterministically, without changing current. */
export function nextUserPlayoffFixture(
  league: LeagueResult,
  seed: number,
  current?: Playoffs,
): LeagueFixture | null {
  return projectUserFixture(league, seed, current).fixture;
}

export function submitPlayoffGame(
  league: LeagueResult,
  seed: number,
  current: Playoffs | undefined,
  game: OfficialGame,
): Playoffs {
  const { playoffs, fixture } = projectUserFixture(league, seed, current);
  if (!fixture || playoffs.playedGames?.[fixture.id])
    throw new Error("No pending user playoff fixture.");
  const validated = validateOfficialGame(game, fixture, league.teams);
  playoffs.modelVersion = 2;
  playoffs.playedGames = { ...playoffs.playedGames, [fixture.id]: validated };
  playOne(playoffs, league, seed);
  return playoffs;
}

function assertPlayedPrefix(playoffs: Playoffs) {
  const completed = new Set(
    playoffs.series.flatMap((series) => series.games.map((game) => game.id)),
  );
  if (Object.keys(playoffs.playedGames ?? {}).some((id) => !completed.has(id)))
    throw new Error("Official playoff result is outside the completed prefix.");
}
