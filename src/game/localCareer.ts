import { FRANCHISE_POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { developPlayer } from "./development";
import {
  DEVELOPMENT_SKILLS,
  DEVELOPMENT_MAX,
  DEVELOPMENT_MIN,
  DEVELOPMENT_YEAR_MAX,
  DEVELOPMENT_YEAR_MIN,
  type DevelopmentRatings,
  type PlayerDevelopment,
} from "./developmentTypes";
import { localGeneration, LOCAL_MAX_YEARS } from "./localFormat";
import {
  localLeagueTeams,
  localDraftSize,
  LOCAL_TEAMS,
  type LocalLeague,
} from "./localLeague";
import { localSeasonBuilder } from "./localSeason";
import { teamRatings, positionRating } from "./ratings";
import { nextRandom } from "./random";
import { exchangePlayers } from "./rosterTrades";
import {
  playoffGameCount,
  replayPlayoffs,
  simulatePlayoffsAsync,
} from "./playoffs";
import type { FinalsMvp, Playoffs } from "./playoffTypes";
import {
  DEFENSE_SCHEMES,
  POSITIONS,
  ROTATIONS,
  ROSTER_SLOTS,
  TACTICS,
  type LeagueAward,
  type LeagueTeam,
  type Position,
  type Roster,
  type SeasonResult,
  type Standing,
} from "./types";

export type LocalTeamSnapshot = Omit<LeagueTeam, "ratings">;
export interface LocalRookiePick {
  teamId: number;
  pokemonId: number;
  releasedId: number;
}
export interface LocalTrade {
  fromTeamId: number;
  teamId: number;
  giveId: number;
  receiveId: number;
  acceptedByTeamIds: number[];
}
export interface LocalDevelopment {
  teamId: number;
  pokemonId: number;
  changes: DevelopmentRatings;
}
export interface LocalSeasonArchive {
  year: number;
  seasonSeed: number;
  teams: LocalTeamSnapshot[];
  standings: Standing[];
  awards: LeagueAward[];
  championId: number;
  finalsMvp: FinalsMvp;
  playoffGames: number;
  development: LocalDevelopment[];
  rookiePicks: LocalRookiePick[];
  trades: LocalTrade[];
}
export interface LocalCareer {
  version: 1;
  year: number;
  phase: "season" | "offseason";
  teams: LeagueTeam[];
  history: LocalSeasonArchive[];
}
function fail(message = "This local career save is invalid."): never {
  throw new Error(message);
}
const snapshot = (teams: LeagueTeam[]): LocalTeamSnapshot[] =>
  structuredClone(teams.map(({ ratings: _, ...team }) => team));
export function restoreLocalTeams(teams: LocalTeamSnapshot[]): LeagueTeam[] {
  return teams.map((source) => {
    const team = structuredClone(source);
    return {
      ...team,
      ratings: teamRatings(
        team.roster,
        team.tactic,
        team.rotation,
        team.development,
        team.rotationPlan,
      ),
    };
  });
}
export function localSeasonSeed(
  draft: LocalLeague,
  year = draft.career?.year ?? 1,
): number {
  const first = (draft.seed ^ 0xc8013ea4) >>> 0;
  return year === 1
    ? first
    : nextRandom((first ^ Math.imul(year, 0x6c8e9cf5)) >>> 0).seed;
}
const rookieGeneration = (
  draft: LocalLeague,
  year = draft.career?.year ?? 1,
) => (draft.options?.mode === "generational" && year < 9 ? year + 1 : 0);
const archiveOf = (draft: LocalLeague) =>
  draft.career?.phase === "offseason" ? draft.career.history.at(-1) : undefined;
const rookieOrder = (archive: LocalSeasonArchive) =>
  [...archive.standings]
    .sort(
      (a, b) =>
        a.wins - b.wins ||
        a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst) ||
        a.teamId - b.teamId,
    )
    .map((s) => s.teamId);
export function currentLocalRookieTurn(draft: LocalLeague) {
  const archive = archiveOf(draft),
    generation = rookieGeneration(draft);
  if (
    !archive ||
    !generation ||
    archive.rookiePicks.length >= draft.options!.format.teamCount * 2
  )
    return null;
  const pick = archive.rookiePicks.length,
    order = rookieOrder(archive),
    teamId = order[pick % order.length];
  return {
    teamId,
    round: Math.floor(pick / order.length) + 1,
    pick: pick + 1,
    manager: draft.managers.find((m) => m.teamId === teamId),
    generation,
  };
}
export function localRookiePool(draft: LocalLeague) {
  const generation = rookieGeneration(draft);
  if (!archiveOf(draft) || !generation || !currentLocalRookieTurn(draft))
    return [];
  const used = new Set(
    draft.career!.history.flatMap((h) => [
      ...h.teams.flatMap((t) => Object.values(t.roster)),
      ...h.rookiePicks.map((p) => p.pokemonId),
    ]),
  );
  return FRANCHISE_POKEMON.filter(
    (p) =>
      localGeneration(p.id) === generation &&
      (draft.includeLegends || !p.legendary) &&
      !used.has(p.id),
  );
}
function withDevelopment(
  teams: LeagueTeam[],
  changes: LocalDevelopment[],
): LeagueTeam[] {
  return teams.map((team) => {
    const development: PlayerDevelopment = {};
    for (const id of Object.values(team.roster)) {
      const offsets = { ...(team.development?.[id!] ?? {}) };
      const change =
        changes.find((c) => c.pokemonId === id && c.teamId === team.id) ??
        fail();
      for (const skill of DEVELOPMENT_SKILLS) {
        const value = (offsets[skill] ?? 0) + (change.changes[skill] ?? 0);
        if (value < DEVELOPMENT_MIN || value > DEVELOPMENT_MAX) fail();
        if (value) offsets[skill] = value;
        else delete offsets[skill];
      }
      development[id!] = offsets;
    }
    return {
      ...team,
      development,
      ratings: teamRatings(
        team.roster,
        team.tactic,
        team.rotation,
        development,
      ),
    };
  });
}
export function beginLocalOffseason(
  draft: LocalLeague,
  result: SeasonResult,
  playoffs: Playoffs,
): LocalLeague {
  if (
    !draft.options ||
    !draft.completed ||
    draft.career?.phase === "offseason" ||
    draft.picks.length !== localDraftSize(draft)
  )
    fail("Finish this season and its championship before the offseason.");
  const year = draft.career?.year ?? 1,
    teams = localLeagueTeams(draft),
    league = result.league;
  if (year >= LOCAL_MAX_YEARS)
    fail(`This local career has reached its ${LOCAL_MAX_YEARS}-season limit.`);
  if (
    !league ||
    JSON.stringify(league.format) !== JSON.stringify(draft.options.format) ||
    JSON.stringify(snapshot(league.teams)) !==
      JSON.stringify(snapshot(teams)) ||
    league.games.length !==
      (draft.options.format.teamCount * draft.options.format.gamesPerTeam) /
        2 ||
    league.standings.some(
      (s) => s.wins + s.losses !== draft.options!.format.gamesPerTeam,
    ) ||
    playoffs.championId === null ||
    !playoffs.finalsMvp
  )
    fail("Finish this season and its championship before the offseason.");
  const count = playoffGameCount(playoffs),
    verified = replayPlayoffs(league, localSeasonSeed(draft), count);
  if (
    verified.championId !== playoffs.championId ||
    verified.finalsMvp?.pokemonId !== playoffs.finalsMvp.pokemonId ||
    (draft.playoffGames !== undefined && draft.playoffGames !== count)
  )
    fail("The championship does not match this season.");
  const development: LocalDevelopment[] = league.players.map((player) => ({
    teamId: player.teamId,
    pokemonId: player.pokemonId,
    changes: developPlayer(
      player,
      teams[player.teamId].development?.[player.pokemonId] ?? {},
      year,
      localSeasonSeed(draft),
    ).changes,
  }));
  if (development.length !== draft.options.format.teamCount * 8) fail();
  const archived: LocalSeasonArchive = {
    year,
    seasonSeed: localSeasonSeed(draft),
    teams: snapshot(teams),
    standings: structuredClone(league.standings),
    awards: structuredClone(league.awards),
    championId: verified.championId!,
    finalsMvp: structuredClone(verified.finalsMvp!),
    playoffGames: count,
    development,
    rookiePicks: [],
    trades: [],
  };
  const next: LocalLeague = {
    ...draft,
    playoffGames: count,
    career: {
      version: 1,
      year,
      phase: "offseason",
      teams: withDevelopment(teams, development),
      history: [...(draft.career?.history ?? []), archived],
    },
  };
  return advanceLocalRookieCpu(next);
}
function appendRookie(
  draft: LocalLeague,
  pokemonId: number,
  releasedId: number,
): LocalLeague {
  const turn = currentLocalRookieTurn(draft),
    career = draft.career;
  if (!turn || !career) fail("There is no pending rookie pick.");
  if (!localRookiePool(draft).some((p) => p.id === pokemonId))
    fail("Choose an available member of this rookie class.");
  const team = career.teams[turn.teamId],
    slot = ROSTER_SLOTS.find((s) => team.roster[s] === releasedId);
  if (!slot) fail("Choose a player from this club to release.");
  const roster = { ...team.roster, [slot]: pokemonId },
    development = { ...team.development, [pokemonId]: {} };
  delete development[releasedId];
  const updated = {
    ...team,
    roster,
    development,
    ratings: teamRatings(roster, team.tactic, team.rotation, development),
  };
  const archived = archiveOf(draft)!;
  return {
    ...draft,
    career: {
      ...career,
      teams: career.teams.map((t) => (t.id === team.id ? updated : t)),
      history: [
        ...career.history.slice(0, -1),
        {
          ...archived,
          rookiePicks: [
            ...archived.rookiePicks,
            { teamId: team.id, pokemonId, releasedId },
          ],
        },
      ],
    },
  };
}
export function recommendedLocalRookie(draft: LocalLeague) {
  const turn = currentLocalRookieTurn(draft);
  if (!turn) return null;
  const team = draft.career!.teams[turn.teamId],
    pool = localRookiePool(draft);
  let best: { pokemonId: number; releasedId: number; score: number } | null =
    null;
  for (const mon of pool)
    for (const slot of ROSTER_SLOTS) {
      const release = team.roster[slot]!,
        outgoing = POKEMON_BY_ID.get(release)!;
      const positions = POSITIONS.includes(slot as Position)
        ? [slot as Position]
        : POSITIONS;
      const incoming = Math.max(
        ...positions.map((p) => positionRating(mon, p)),
      );
      const previous = Math.max(
        ...positions.map((p) =>
          positionRating(outgoing, p, team.development?.[release]),
        ),
      );
      const score = incoming - previous;
      if (!best || score > best.score)
        best = { pokemonId: mon.id, releasedId: release, score };
    }
  return best;
}
export function advanceLocalRookieCpu(source: LocalLeague): LocalLeague {
  let draft = source;
  for (
    let turn = currentLocalRookieTurn(draft);
    turn && !turn.manager;
    turn = currentLocalRookieTurn(draft)
  ) {
    const choice = recommendedLocalRookie(draft);
    if (!choice) fail("This rookie class cannot fill the remaining draft.");
    draft = appendRookie(draft, choice.pokemonId, choice.releasedId);
  }
  return draft;
}
export function pickLocalRookie(
  draft: LocalLeague,
  pokemonId: number,
  releasedId: number,
): LocalLeague {
  if (!currentLocalRookieTurn(draft)?.manager)
    fail("Wait for a friend's rookie turn.");
  return advanceLocalRookieCpu(appendRookie(draft, pokemonId, releasedId));
}
export function evaluateLocalTrade(
  draft: LocalLeague,
  fromTeamId: number,
  teamId: number,
  giveId: number,
  receiveId: number,
) {
  const empty = {
    accepted: false,
    reason:
      "Trades require two different clubs with the selected players after the rookie draft.",
    fromGain: 0,
    toGain: 0,
    requiresAcceptance: [] as number[],
  };
  if (
    !archiveOf(draft) ||
    currentLocalRookieTurn(draft) ||
    fromTeamId === teamId
  )
    return empty;
  const teams = draft.career!.teams,
    from = teams.find((t) => t.id === fromTeamId),
    to = teams.find((t) => t.id === teamId);
  if (
    !from ||
    !to ||
    !Object.values(from.roster).includes(giveId) ||
    !Object.values(to.roster).includes(receiveId)
  )
    return empty;
  const next = exchangePlayers(teams, fromTeamId, teamId, giveId, receiveId),
    fromGain = next[fromTeamId].ratings.overall - from.ratings.overall,
    toGain = next[teamId].ratings.overall - to.ratings.overall;
  const ability = (team: LeagueTeam, id: number) =>
    Math.max(
      ...POSITIONS.map((p) =>
        positionRating(POKEMON_BY_ID.get(id)!, p, team.development?.[id]),
      ),
    );
  const difference = ability(to, receiveId) - ability(from, giveId);
  const isHuman = (id: number) => draft.managers.some((m) => m.teamId === id);
  const accepted =
    (isHuman(fromTeamId) ||
      (fromGain >= -0.15 && difference + 2 * fromGain >= -2.5)) &&
    (isHuman(teamId) || (toGain >= -0.15 && -difference + 2 * toGain >= -2.5));
  return {
    accepted,
    reason: accepted
      ? `Roster fit changes: ${from.name} ${fromGain >= 0 ? "+" : ""}${fromGain.toFixed(1)}, ${to.name} ${toGain >= 0 ? "+" : ""}${toGain.toFixed(1)}. Each friend must agree; CPU clubs protect roster fit and player value.`
      : "A CPU club declined: this exchange loses too much roster fit or player value.",
    fromGain,
    toGain,
    requiresAcceptance: [fromTeamId, teamId].filter(isHuman),
  };
}
export function applyLocalTrade(
  draft: LocalLeague,
  fromTeamId: number,
  teamId: number,
  giveId: number,
  receiveId: number,
  acceptedByTeamIds: number[] = [],
): LocalLeague {
  const evaluation = evaluateLocalTrade(
    draft,
    fromTeamId,
    teamId,
    giveId,
    receiveId,
  );
  if (!evaluation.accepted) fail(evaluation.reason);
  if (
    !Array.isArray(acceptedByTeamIds) ||
    acceptedByTeamIds.length !== evaluation.requiresAcceptance.length ||
    new Set(acceptedByTeamIds).size !== acceptedByTeamIds.length ||
    evaluation.requiresAcceptance.some((id) => !acceptedByTeamIds.includes(id))
  )
    fail("Both friend managers must agree to this trade.");
  const career = draft.career!,
    archived = archiveOf(draft)!;
  if (archived.trades.length >= 100)
    fail("The offseason trade limit is 100 exchanges.");
  const trade: LocalTrade = {
    fromTeamId,
    teamId,
    giveId,
    receiveId,
    acceptedByTeamIds: [...evaluation.requiresAcceptance],
  };
  return {
    ...draft,
    career: {
      ...career,
      teams: exchangePlayers(
        career.teams,
        fromTeamId,
        teamId,
        giveId,
        receiveId,
      ),
      history: [
        ...career.history.slice(0, -1),
        { ...archived, trades: [...archived.trades, trade] },
      ],
    },
  };
}
function nextYearTeams(career: LocalCareer): LeagueTeam[] {
  const archived = career.history.at(-1)!;
  return career.teams.map((team) => {
    const retained =
      Object.values(team.roster).filter((id) =>
        Object.values(archived.teams[team.id].roster).includes(id),
      ).length / 8;
    return {
      ...team,
      ...(team.engineRules
        ? {
            engineRules: {
              ...team.engineRules,
              familiarity: Math.min(
                1,
                (team.engineRules.familiarity + 0.15) * retained,
              ),
            },
          }
        : {}),
    };
  });
}
export function startNextLocalSeason(draft: LocalLeague): LocalLeague {
  if (
    !draft.career ||
    draft.career.phase !== "offseason" ||
    currentLocalRookieTurn(draft)
  )
    fail("Complete the offseason rookie draft before the next season.");
  if (draft.career.year >= LOCAL_MAX_YEARS)
    fail("This local career has reached its season limit.");
  const { playoffGames: _, ...base } = draft;
  return {
    ...base,
    completed: false,
    career: {
      ...draft.career,
      year: draft.career.year + 1,
      phase: "season",
      teams: nextYearTeams(draft.career),
    },
  };
}
export function replayLocalHistory(draft: LocalLeague, year: number) {
  const archived = draft.career?.history.find((h) => h.year === year);
  if (!archived || !draft.options)
    fail("No archived local season exists for this year.");
  const job = localSeasonBuilder(
    restoreLocalTeams(archived.teams),
    draft.options.format,
    archived.seasonSeed,
  );
  job.fixtures.forEach(job.play);
  const result = job.finish(),
    playoffs = replayPlayoffs(
      result.league!,
      archived.seasonSeed,
      archived.playoffGames,
    );
  verifyArchivedResult(archived, result, playoffs);
  return { result, playoffs };
}
export async function replayLocalHistoryAsync(
  draft: LocalLeague,
  year: number,
  onProgress: (completed: number, total: number) => void = () => {},
  signal?: AbortSignal,
) {
  const archived = draft.career?.history.find((h) => h.year === year);
  if (!archived || !draft.options)
    fail("No archived local season exists for this year.");
  signal?.throwIfAborted();
  const job = localSeasonBuilder(
      restoreLocalTeams(archived.teams),
      draft.options.format,
      archived.seasonSeed,
    ),
    batch = draft.options.format.teamCount / 2;
  for (let i = 0; i < job.fixtures.length; i += batch) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    signal?.throwIfAborted();
    job.fixtures.slice(i, i + batch).forEach(job.play);
    onProgress(Math.min(i + batch, job.fixtures.length), job.fixtures.length);
  }
  signal?.throwIfAborted();
  const result = job.finish();
  const playoffs = await simulatePlayoffsAsync(
    result.league!,
    archived.seasonSeed,
    undefined,
    "all",
    (count, total) =>
      onProgress(job.fixtures.length + count, job.fixtures.length + total),
    signal,
  );
  signal?.throwIfAborted();
  verifyArchivedResult(archived, result, playoffs);
  return { result, playoffs };
}
function verifyArchivedResult(
  archived: LocalSeasonArchive,
  result: SeasonResult,
  playoffs: Playoffs,
) {
  if (
    playoffs.championId === null ||
    playoffs.championId !== archived.championId ||
    playoffGameCount(playoffs) !== archived.playoffGames ||
    playoffs.finalsMvp?.playerId !== archived.finalsMvp.playerId ||
    playoffs.finalsMvp?.score !== archived.finalsMvp.score
  )
    fail("This archived championship does not match its frozen inputs.");
  if (
    archived.standings.some((standing, i) =>
      Object.entries(standing).some(
        ([key, value]) =>
          result.league!.standings[i][key as keyof Standing] !== value,
      ),
    ) ||
    archived.awards.some(
      (award, i) =>
        award.playerId !== result.league!.awards[i]?.playerId ||
        award.score !== result.league!.awards[i]?.score,
    )
  )
    fail("This archived season does not match its frozen inputs.");
}

// Saved history is compact input plus bounded summaries. Restore roster/development
// chronology transaction by transaction; cached ratings never participate in replay.
function object(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, any>;
}
function integer(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    return fail();
  return value;
}
function array(value: unknown, length: number): any[] {
  if (!Array.isArray(value) || value.length !== length) return fail();
  return value;
}
function changes(value: unknown, annual = false): DevelopmentRatings {
  const source = object(value),
    result: DevelopmentRatings = {};
  for (const [key, value] of Object.entries(source)) {
    if (!DEVELOPMENT_SKILLS.includes(key as never)) fail();
    result[key as keyof DevelopmentRatings] = integer(
      value,
      annual ? DEVELOPMENT_YEAR_MIN : DEVELOPMENT_MIN,
      annual ? DEVELOPMENT_YEAR_MAX : DEVELOPMENT_MAX,
    );
  }
  return result;
}
function parseTeams(
  value: unknown,
  draft: LocalLeague,
  year: number,
): LeagueTeam[] {
  const used = new Set<number>(),
    format = draft.options!.format;
  return array(value, format.teamCount).map((value, id) => {
    const row = object(value),
      rawRoster = object(row.roster),
      roster = {} as Roster;
    if (
      row.id !== id ||
      row.name !== LOCAL_TEAMS[id].name ||
      row.simulationVersion !== 2 ||
      !TACTICS.includes(row.tactic) ||
      !ROTATIONS.includes(row.rotation) ||
      !DEFENSE_SCHEMES.includes(row.defense) ||
      Object.keys(rawRoster).length !== 8 ||
      row.rotationPlan !== undefined
    )
      fail();
    for (const slot of ROSTER_SLOTS) {
      const member = integer(rawRoster[slot], 1, 1025),
        mon = POKEMON_BY_ID.get(member);
      if (
        !mon ||
        used.has(member) ||
        (!draft.includeLegends && mon.legendary) ||
        (draft.options!.mode === "generational" &&
          localGeneration(member) > Math.min(9, year))
      )
        fail();
      used.add(member);
      roster[slot] = member;
    }
    let development: PlayerDevelopment | undefined;
    if (row.development !== undefined) {
      const source = object(row.development);
      if (Object.keys(source).length !== 8) fail();
      development = {};
      for (const [key, value] of Object.entries(source)) {
        const member = Number(key);
        if (String(member) !== key || !Object.values(roster).includes(member))
          fail();
        development[member] = changes(value);
      }
    }
    const expected = draft.options!.engineRules,
      rules = object(row.engineRules);
    if (
      rules.version !== 1 ||
      rules.abilities !== expected.abilities ||
      rules.adaptiveCoaching !==
        (expected.adaptiveCoaching &&
          !draft.managers.some((m) => m.teamId === id)) ||
      typeof rules.familiarity !== "number" ||
      !Number.isFinite(rules.familiarity) ||
      rules.familiarity < 0 ||
      rules.familiarity > 1
    )
      fail();
    const team: LocalTeamSnapshot = {
      id,
      name: row.name,
      simulationVersion: 2,
      roster,
      tactic: row.tactic,
      rotation: row.rotation,
      defense: row.defense,
      engineRules: {
        version: 1,
        abilities: rules.abilities,
        adaptiveCoaching: rules.adaptiveCoaching,
        familiarity: rules.familiarity,
      },
      ...(development ? { development } : {}),
    };
    return restoreLocalTeams([team])[0];
  });
}
function sameRosterState(actual: LeagueTeam[], expected: LeagueTeam[]) {
  for (let i = 0; i < actual.length; i++) {
    const a = actual[i],
      e = expected[i];
    if (JSON.stringify(a.engineRules) !== JSON.stringify(e.engineRules)) fail();
    if (
      Object.values(a.roster).some(
        (id) => !Object.values(e.roster).includes(id),
      )
    )
      fail();
    for (const id of Object.values(a.roster))
      for (const skill of DEVELOPMENT_SKILLS)
        if (
          (a.development?.[id!]?.[skill] ?? 0) !==
          (e.development?.[id!]?.[skill] ?? 0)
        )
          fail();
    if (Boolean(a.development) !== Boolean(e.development)) fail();
  }
}
function parseStandings(value: unknown, draft: LocalLeague): Standing[] {
  const format = draft.options!.format,
    games = format.gamesPerTeam;
  const rows = array(value, format.teamCount).map((value, id) => {
    const row = object(value);
    if (row.teamId !== id) fail();
    const wins = integer(row.wins, 0, games),
      losses = integer(row.losses, 0, games),
      homeWins = integer(row.homeWins, 0, games / 2),
      awayWins = integer(row.awayWins, 0, games / 2),
      streak = integer(row.streak, -games, games),
      lastTen = integer(row.lastTen, 0, Math.min(10, games));
    if (
      wins + losses !== games ||
      homeWins + awayWins !== wins ||
      !streak ||
      streak > wins ||
      -streak > losses ||
      (streak > 0 && lastTen < Math.min(10, streak)) ||
      (streak < 0 && lastTen > Math.max(0, 10 + streak))
    )
      fail();
    return {
      teamId: id,
      wins,
      losses,
      homeWins,
      awayWins,
      streak,
      lastTen,
      pointsFor: integer(row.pointsFor, 1, 1000000),
      pointsAgainst: integer(row.pointsAgainst, 1, 1000000),
    };
  });
  if (
    rows.reduce((n, r) => n + r.wins, 0) !== (format.teamCount * games) / 2 ||
    rows.reduce((n, r) => n + r.pointsFor - r.pointsAgainst, 0) !== 0
  )
    fail();
  return rows;
}
function parseHonor(value: unknown, teams: LeagueTeam[]) {
  const row = object(value),
    teamId = integer(row.teamId, 0, teams.length - 1),
    pokemonId = integer(row.pokemonId, 1, 1025);
  if (
    row.playerId !== `${teamId}:${pokemonId}` ||
    !Object.values(teams[teamId].roster).includes(pokemonId) ||
    typeof row.score !== "number" ||
    !Number.isFinite(row.score) ||
    Math.abs(row.score) > 1000000 ||
    typeof row.value !== "string" ||
    row.value.length > 200
  )
    fail();
  return {
    teamId,
    pokemonId,
    playerId: row.playerId as string,
    score: row.score,
    value: row.value as string,
  };
}
export function parseLocalCareer(
  value: unknown,
  draft: LocalLeague,
  completed: boolean,
  playoffGames: number | undefined,
): LocalCareer {
  if (!draft.options || draft.picks.length !== localDraftSize(draft)) fail();
  const raw = object(value),
    year = integer(raw.year, 1, LOCAL_MAX_YEARS);
  if (
    raw.version !== 1 ||
    !["season", "offseason"].includes(raw.phase) ||
    (raw.phase === "offseason" && !completed) ||
    (raw.phase === "season" && year === 1)
  )
    fail();
  const rawHistory = array(
    raw.history,
    raw.phase === "offseason" ? year : year - 1,
  );
  let expected = localLeagueTeams(draft);
  const history: LocalSeasonArchive[] = [];
  for (let i = 0; i < rawHistory.length; i++) {
    const row = object(rawHistory[i]),
      archiveYear = i + 1,
      teams = parseTeams(row.teams, draft, archiveYear);
    sameRosterState(teams, expected);
    if (
      row.year !== archiveYear ||
      row.seasonSeed !== localSeasonSeed(draft, archiveYear)
    )
      fail();
    const standings = parseStandings(row.standings, draft),
      championId = integer(row.championId, 0, teams.length - 1),
      finalsMvp = parseHonor(row.finalsMvp, teams);
    const qualified = [...standings]
      .sort(
        (a, b) =>
          b.wins - a.wins ||
          b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
          a.teamId - b.teamId,
      )
      .slice(0, draft.options.format.playoffTeams);
    if (
      finalsMvp.teamId !== championId ||
      !qualified.some((s) => s.teamId === championId)
    )
      fail();
    const playoffGames = integer(
      row.playoffGames,
      (draft.options.format.playoffTeams - 1) *
        Math.ceil(draft.options.format.bestOf / 2),
      (draft.options.format.playoffTeams - 1) * draft.options.format.bestOf,
    );
    const awardIds = [
      "mvp",
      "defense",
      "sixth",
      "scoring",
      "playmaking",
      "rebounding",
    ];
    const awards = array(row.awards, 6).map((value, index) => {
      const a = object(value);
      if (
        a.id !== awardIds[index] ||
        typeof a.title !== "string" ||
        a.title.length > 100 ||
        typeof a.description !== "string" ||
        a.description.length > 300
      )
        fail();
      const finalists = array(a.finalists, 3).map((v) => parseHonor(v, teams));
      if (new Set(finalists.map((f) => f.playerId)).size !== 3) fail();
      const honor = parseHonor(a, teams);
      if (finalists[0].playerId !== honor.playerId) fail();
      return {
        ...honor,
        id: a.id,
        title: a.title,
        description: a.description,
        finalists,
      } as LeagueAward;
    });
    const seen = new Set<number>();
    const development = array(row.development, teams.length * 8).map(
      (value) => {
        const d = object(value),
          teamId = integer(d.teamId, 0, teams.length - 1),
          pokemonId = integer(d.pokemonId, 1, 1025);
        if (
          seen.has(pokemonId) ||
          !Object.values(teams[teamId].roster).includes(pokemonId)
        )
          fail();
        seen.add(pokemonId);
        return { teamId, pokemonId, changes: changes(d.changes, true) };
      },
    );
    if (
      !Array.isArray(row.rookiePicks) ||
      row.rookiePicks.length > teams.length * 2 ||
      !Array.isArray(row.trades) ||
      row.trades.length > 100
    )
      fail();
    const archived: LocalSeasonArchive = {
      year: archiveYear,
      seasonSeed: row.seasonSeed,
      teams: snapshot(teams),
      standings,
      championId,
      finalsMvp,
      playoffGames,
      awards,
      development,
      rookiePicks: [],
      trades: [],
    };
    let replay: LocalLeague = {
      ...draft,
      completed: true,
      playoffGames,
      career: {
        version: 1,
        year: archiveYear,
        phase: "offseason",
        teams: withDevelopment(teams, development),
        history: [...history, archived],
      },
    };
    for (const value of row.rookiePicks) {
      const p = object(value),
        turn = currentLocalRookieTurn(replay);
      if (!turn || p.teamId !== turn.teamId) fail();
      replay = appendRookie(
        replay,
        integer(p.pokemonId, 1, 1025),
        integer(p.releasedId, 1, 1025),
      );
    }
    for (const value of row.trades) {
      const t = object(value);
      if (
        !Array.isArray(t.acceptedByTeamIds) ||
        t.acceptedByTeamIds.length > 2 ||
        t.acceptedByTeamIds.some((id: unknown) => !Number.isInteger(id))
      )
        fail();
      replay = applyLocalTrade(
        replay,
        integer(t.fromTeamId, 0, teams.length - 1),
        integer(t.teamId, 0, teams.length - 1),
        integer(t.giveId, 1, 1025),
        integer(t.receiveId, 1, 1025),
        t.acceptedByTeamIds,
      );
    }
    history.push(replay.career!.history.at(-1)!);
    if (i < rawHistory.length - 1 || raw.phase === "season") {
      if (currentLocalRookieTurn(replay)) fail();
      expected = nextYearTeams(replay.career!);
    } else expected = replay.career!.teams;
  }
  const current = parseTeams(
    raw.teams,
    draft,
    raw.phase === "offseason" ? Math.min(9, year + 1) : year,
  );
  sameRosterState(current, expected);
  if (
    raw.phase === "offseason" &&
    playoffGames !== history.at(-1)!.playoffGames
  )
    fail();
  // A stored draft always pauses at the next human, as CPU turns are atomic.
  const result: LocalCareer = {
    version: 1,
    year,
    phase: raw.phase,
    teams: current,
    history,
  };
  const turn = currentLocalRookieTurn({ ...draft, career: result });
  if (turn && !turn.manager) fail();
  return result;
}
