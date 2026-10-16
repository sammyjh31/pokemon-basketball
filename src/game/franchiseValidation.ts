import { validateRosterTransactions } from "./franchiseTransactions";
import { POKEMON_BY_ID } from "../data/pokemon";
import { OPPONENTS } from "../data/opponents";
import { positionRating, teamRatings } from "./ratings";
import { validateRotationPlan } from "./rotationPlan";
import { validateTrainingPlans } from "./training";
import { replayArchivedSeasonSync } from "./archive";
import { leagueSchedule } from "./league";
import { validateOfficialGame } from "./officialGame";
import { replayPlayoffs } from "./playoffs";
import type { SeasonReplayArchive } from "./franchiseFeatures";
import type { Playoffs } from "./playoffTypes";
import type { SeasonResult } from "./types";
export type VerifiedArchives = ReadonlyMap<
  number,
  { regular: SeasonResult; playoffs: Playoffs }
>;
import {
  DEVELOPMENT_SKILLS,
  DEVELOPMENT_MIN,
  DEVELOPMENT_MAX,
  DEVELOPMENT_YEAR_MIN,
  DEVELOPMENT_YEAR_MAX,
  CPU_TRADE_LIMIT,
  type DevelopmentRatings,
  type PlayerDevelopment,
  type OffseasonReport,
  type PlayerDevelopmentChange,
} from "./developmentTypes";
import {
  CAREER_KEYS,
  FRANCHISE_MAX_YEARS,
  FRANCHISE_MAX_TRADES,
  type CareerPlayer,
  type CareerTotals,
  type Franchise,
  type FranchiseSeason,
  type FranchiseTrade,
  type HistoricalHonor,
} from "./franchiseTypes";
import {
  DEFENSE_SCHEMES,
  POSITIONS,
  ROTATIONS,
  ROSTER_SLOTS,
  TACTICS,
  type LeaguePlayer,
  type LeagueTeam,
  type Roster,
  type Run,
  type Standing,
} from "./types";

const fail = (): never => {
  throw new Error("Invalid saved franchise");
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    return fail();
  return value;
}
function number(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    return fail();
  return value;
}
function text(value: unknown, max = 1000): string {
  if (typeof value !== "string" || !value.length || value.length > max)
    return fail();
  return value;
}
function array(value: unknown, length: number): unknown[] {
  if (!Array.isArray(value) || value.length !== length) return fail();
  return value;
}
function species(value: unknown, includeLegends: boolean): number {
  const id = integer(value, 1, 1025),
    mon = POKEMON_BY_ID.get(id);
  if (!mon || (!includeLegends && mon.legendary)) return fail();
  return id;
}
function sameMembers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

function developmentRatings(
  value: unknown,
  min = DEVELOPMENT_MIN,
  max = DEVELOPMENT_MAX,
): DevelopmentRatings {
  const source = object(value),
    result: DevelopmentRatings = {};
  for (const [key, value] of Object.entries(source)) {
    if (!DEVELOPMENT_SKILLS.includes(key as never)) return fail();
    result[key as keyof DevelopmentRatings] = integer(value, min, max);
  }
  return result;
}
function development(value: unknown, roster: Roster): PlayerDevelopment {
  const source = object(value),
    result: PlayerDevelopment = {},
    ids = Object.values(roster);
  if (Object.keys(source).length !== 8) return fail();
  for (const [key, value] of Object.entries(source)) {
    const id = Number(key);
    if (String(id) !== key || !ids.includes(id)) return fail();
    result[id] = developmentRatings(value);
  }
  return result;
}
function sameDevelopment(
  actual: PlayerDevelopment | undefined,
  expected: PlayerDevelopment,
  ids: number[],
): void {
  if (!actual) return fail();
  for (const id of ids)
    for (const skill of DEVELOPMENT_SKILLS)
      if ((actual[id]?.[skill] ?? 0) !== (expected[id]?.[skill] ?? 0))
        return fail();
}
function reports(
  value: unknown,
  history: FranchiseSeason[],
  trades: FranchiseTrade[],
  lastYear: number,
  allowPendingYear = false,
): {
  reports: OffseasonReport[];
  cumulative: PlayerDevelopment;
  previous: PlayerDevelopment;
} {
  if (!Array.isArray(value) || !value.length || value.length > history.length)
    return fail();
  const cumulative: PlayerDevelopment = {},
    previous: PlayerDevelopment = {},
    cpuIndices = new Set<number>();
  let priorYear: number | undefined,
    previousTradeEnd = 0;
  const parsed: OffseasonReport[] = value.map((value) => {
    const row = object(value),
      year = integer(row.year, 1, lastYear),
      archived = history[year - 1];
    if (
      !archived ||
      row.modelVersion !== 1 ||
      (priorYear !== undefined && year !== priorYear + 1)
    )
      return fail();
    priorYear = year;
    const seen = new Set<number>();
    const players = array(row.players, 240).map(
      (value): PlayerDevelopmentChange => {
        const player = object(value),
          pokemonId = integer(player.pokemonId, 1, 1025),
          teamId = integer(player.teamId, 0, 29);
        if (
          seen.has(pokemonId) ||
          !archived.rosters[teamId].includes(pokemonId)
        )
          return fail();
        seen.add(pokemonId);
        const changes = developmentRatings(
            player.changes,
            DEVELOPMENT_YEAR_MIN,
            DEVELOPMENT_YEAR_MAX,
          ),
          beforeOffsets = cumulative[pokemonId] ?? {},
          afterOffsets = { ...beforeOffsets };
        for (const skill of DEVELOPMENT_SKILLS) {
          const updated = (beforeOffsets[skill] ?? 0) + (changes[skill] ?? 0);
          if (updated < DEVELOPMENT_MIN || updated > DEVELOPMENT_MAX)
            return fail();
          if (updated) afterOffsets[skill] = updated;
          else delete afterOffsets[skill];
        }
        const best = (offsets: DevelopmentRatings) =>
          Math.round(
            Math.max(
              ...POSITIONS.map((position) =>
                positionRating(
                  POKEMON_BY_ID.get(pokemonId)!,
                  position,
                  offsets,
                ),
              ),
            ) * 10,
          ) / 10;
        const before = number(player.before, 0, 100),
          after = number(player.after, 0, 100);
        if (before !== best(beforeOffsets) || after !== best(afterOffsets))
          return fail();
        if (year < lastYear) previous[pokemonId] = { ...afterOffsets };
        cumulative[pokemonId] = afterOffsets;
        if (
          !["breakout", "growth", "steady", "decline", "slump"].includes(
            player.outcome as string,
          ) ||
          !Array.isArray(player.reasons) ||
          !player.reasons.length ||
          player.reasons.length > 32
        )
          return fail();
        return {
          pokemonId,
          teamId,
          before,
          after,
          minutesPerGame: number(player.minutesPerGame, 0, 1000),
          impactPer36: number(player.impactPer36, -10000, 10000),
          changes,
          outcome: player.outcome as PlayerDevelopmentChange["outcome"],
          reasons: player.reasons.map((reason) => text(reason)),
        };
      },
    );
    const tradeStart = integer(row.tradeStart, previousTradeEnd, trades.length),
      tradeCount = integer(row.tradeCount, 0, CPU_TRADE_LIMIT),
      used = new Set<number>();
    if (tradeStart + tradeCount > trades.length) return fail();
    for (let i = tradeStart; i < tradeStart + tradeCount; i++) {
      const trade = trades[i];
      if (
        trade.year !== year ||
        trade.source !== "cpu" ||
        used.has(trade.fromTeamId!) ||
        used.has(trade.teamId)
      )
        return fail();
      used.add(trade.fromTeamId!);
      used.add(trade.teamId);
      cpuIndices.add(i);
    }
    if (
      trades.slice(0, tradeStart).some((trade) => trade.year > year) ||
      trades.slice(tradeStart + tradeCount).some((trade) => trade.year < year)
    )
      return fail();
    previousTradeEnd = tradeStart + tradeCount;
    return { modelVersion: 1, year, players, tradeStart, tradeCount };
  });
  if (
    (parsed.at(-1)!.year !== lastYear &&
      !(allowPendingYear && parsed.at(-1)!.year === lastYear - 1)) ||
    trades.some(
      (trade, index) => trade.source === "cpu" && !cpuIndices.has(index),
    )
  )
    return fail();
  return { reports: parsed, cumulative, previous };
}

/** Reconstruct fixed league inputs; cached ratings never influence replay. */
export function validateLeagueTeams(
  value: unknown,
  includeLegends: boolean,
): LeagueTeam[] {
  const taken = new Set<number>();
  const rows = array(value, 30),
    developed = rows.filter((value) =>
      Object.hasOwn(object(value), "development"),
    ).length;
  if (developed !== 0 && developed !== 30) return fail();
  return rows.map((value, index) => {
    const row = object(value),
      source = object(row.roster),
      roster = {} as Roster;
    const name =
      index === 0 ? "Kanto Basketball Club" : OPPONENTS[index - 1].name;
    if (
      row.id !== index ||
      row.name !== name ||
      Object.keys(source).length !== 8 ||
      !TACTICS.includes(row.tactic as never) ||
      !ROTATIONS.includes(row.rotation as never) ||
      !DEFENSE_SCHEMES.includes(row.defense as never)
    )
      return fail();
    for (const slot of ROSTER_SLOTS) {
      const id = species(source[slot], includeLegends);
      if (taken.has(id)) return fail();
      taken.add(id);
      roster[slot] = id;
    }
    const tactic = row.tactic as LeagueTeam["tactic"],
      rotation = row.rotation as LeagueTeam["rotation"];
    const offsets = developed
      ? development(row.development, roster)
      : undefined;
    const rotationPlan = Object.hasOwn(row, "rotationPlan")
      ? validateRotationPlan(row.rotationPlan)
      : undefined;
    return {
      id: index,
      name,
      roster,
      tactic,
      rotation,
      defense: row.defense as LeagueTeam["defense"],
      ratings: teamRatings(roster, tactic, rotation, offsets, rotationPlan),
      ...(offsets ? { development: offsets } : {}),
      ...(rotationPlan ? { rotationPlan } : {}),
    };
  });
}

function historicalRosters(
  value: unknown,
  includeLegends: boolean,
  leagueIds: number[] | undefined,
): number[][] {
  const rosters = array(value, 30).map((row) =>
    array(row, 8).map((id) => species(id, includeLegends)),
  );
  if (
    new Set(rosters.flat()).size !== 240 ||
    (leagueIds !== undefined && !sameMembers(rosters.flat(), leagueIds))
  )
    return fail();
  return rosters;
}
function honor(value: unknown, rosters: number[][]): HistoricalHonor {
  const row = object(value),
    teamId = integer(row.teamId, 0, 29),
    pokemonId = integer(row.pokemonId, 1, 1025);
  if (!rosters[teamId].includes(pokemonId)) return fail();
  return { pokemonId, teamId };
}
function standings(value: unknown): Standing[] {
  const rows = array(value, 30).map((value, index) => {
    const row = object(value);
    if (row.teamId !== index) return fail();
    const wins = integer(row.wins, 0, 82),
      losses = integer(row.losses, 0, 82),
      homeWins = integer(row.homeWins, 0, 41),
      awayWins = integer(row.awayWins, 0, 41);
    if (wins + losses !== 82 || homeWins + awayWins !== wins) return fail();
    const streak = integer(row.streak, -82, 82),
      lastTen = integer(row.lastTen, 0, 10);
    if (
      !streak ||
      (streak > 0 && (streak > wins || lastTen < Math.min(10, streak))) ||
      (streak < 0 && (-streak > losses || lastTen > Math.max(0, 10 + streak)))
    )
      return fail();
    return {
      teamId: index,
      wins,
      losses,
      pointsFor: integer(row.pointsFor, 1, 1000000),
      pointsAgainst: integer(row.pointsAgainst, 1, 1000000),
      homeWins,
      awayWins,
      streak,
      lastTen,
    };
  });
  if (
    rows.reduce((sum, row) => sum + row.wins, 0) !== 1230 ||
    rows.reduce((sum, row) => sum + row.pointsFor - row.pointsAgainst, 0) !== 0
  )
    return fail();
  return rows;
}
function qualifiers(rows: Standing[]): number[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst) ||
        a.teamId - b.teamId,
    )
    .slice(0, 16)
    .map((row) => row.teamId);
}
function archivedSeason(
  value: unknown,
  index: number,
  includeLegends: boolean,
  leagueIds: number[] | undefined,
  preliminary = false,
  verified?: VerifiedArchives extends ReadonlyMap<number, infer T> ? T : never,
): FranchiseSeason {
  const row = object(value);
  if (row.year !== index + 1) return fail();
  const rosters = historicalRosters(row.rosters, includeLegends, leagueIds);
  const ids = [
    "mvp",
    "defense",
    "sixth",
    "scoring",
    "playmaking",
    "rebounding",
  ] as const;
  const awards = array(row.awards, 6).map((value, index) => {
    const award = object(value);
    if (award.id !== ids[index]) return fail();
    return {
      id: ids[index],
      title: text(award.title),
      ...honor(award, rosters),
      description: text(award.description),
      value: text(award.value),
    };
  });
  const selections = (value: unknown) => {
    const selected = array(value, 5).map((item) => honor(item, rosters));
    if (new Set(selected.map((item) => item.pokemonId)).size !== 5)
      return fail();
    return selected;
  };
  const allLeague = selections(row.allLeague),
    allDefense = selections(row.allDefense);
  if (
    allLeague[0].pokemonId !== awards[0].pokemonId ||
    allDefense[0].pokemonId !== awards[1].pokemonId
  )
    return fail();
  const championId = integer(row.championId, 0, 29),
    runnerUpId = integer(row.runnerUpId, 0, 29),
    mvp = object(row.finalsMvp),
    identity = honor(mvp, rosters);
  const rows = standings(row.standings),
    qualified = qualifiers(rows);
  if (
    championId === runnerUpId ||
    !qualified.includes(championId) ||
    !qualified.includes(runnerUpId) ||
    identity.teamId !== championId ||
    mvp.playerId !== `${identity.teamId}:${identity.pokemonId}`
  )
    return fail();
  const season: FranchiseSeason = {
    year: index + 1,
    seasonSeed: integer(row.seasonSeed, 0, 0xffffffff),
    standings: rows,
    rosters,
    awards,
    allLeague,
    allDefense,
    championId,
    runnerUpId,
    runnerUpWins: integer(row.runnerUpWins, 0, 3),
    finalsMvp: {
      playerId: mvp.playerId,
      ...identity,
      score: number(mvp.score, -1000000, 1000000),
      value: text(mvp.value),
    },
  };
  if (Object.hasOwn(row, "replay"))
    season.replay = archivedReplay(
      row.replay,
      season,
      includeLegends,
      preliminary,
      verified,
    );
  return season;
}
function archivedReplay(
  value: unknown,
  season: FranchiseSeason,
  includeLegends: boolean,
  preliminary = false,
  verified?: VerifiedArchives extends ReadonlyMap<number, infer T> ? T : never,
): SeasonReplayArchive {
  const row = object(value);
  if (
    row.modelVersion !== 1 ||
    ![3, 4, 5, 6].includes(row.seasonModel as number)
  )
    return fail();
  const teams = validateLeagueTeams(row.teams, includeLegends);
  if (
    teams.some((team, index) =>
      ROSTER_SLOTS.some(
        (slot, slotIndex) =>
          team.roster[slot] !== season.rosters[index][slotIndex],
      ),
    )
  )
    return fail();
  if (
    (row.seasonModel === 3 || row.seasonModel === 4) &&
    teams.some((team) => team.development || team.rotationPlan)
  )
    return fail();
  if (
    row.seasonModel === 5 &&
    teams.some((team) => !team.development || team.rotationPlan)
  )
    return fail();
  array(row.regularPlayers, 240);
  if (!Array.isArray(row.playoffPlayers) || row.playoffPlayers.length !== 128)
    return fail();
  const source = object(row.playedGames),
    playedGames: SeasonReplayArchive["playedGames"] = {};
  if (
    Object.keys(source).length > 82 ||
    (row.seasonModel !== 6 && Object.keys(source).length)
  )
    return fail();
  const fixtures = new Map(
    leagueSchedule(season.seasonSeed).map((fixture) => [fixture.id, fixture]),
  );
  for (const [id, game] of Object.entries(source)) {
    const fixture = fixtures.get(id);
    if (!fixture || (fixture.homeTeamId !== 0 && fixture.awayTeamId !== 0))
      return fail();
    playedGames[id] = validateOfficialGame(game, fixture, teams);
  }
  const bracket = object(row.playoffs);
  if (![1, 2].includes(bracket.modelVersion as number)) return fail();
  const series = array(bracket.series, 15);
  const gameCount = series.reduce<number>((total, value) => {
    const games = object(value).games;
    if (!Array.isArray(games) || games.length < 4 || games.length > 7)
      return fail();
    return total + games.length;
  }, 0);
  const parsedPlayers = (
    values: unknown[],
    maxGames: number,
  ): LeaguePlayer[] => {
    const seen = new Set<number>();
    return values.map((value) => {
      const player = object(value),
        teamId = integer(player.teamId, 0, 29),
        pokemonId = species(player.pokemonId, includeLegends);
      const slot = ROSTER_SLOTS.find(
        (slot) => teams[teamId].roster[slot] === pokemonId,
      );
      if (
        !slot ||
        player.slot !== slot ||
        player.playerId !== `${teamId}:${pokemonId}` ||
        player.teamName !== teams[teamId].name ||
        seen.has(pokemonId)
      )
        return fail();
      seen.add(pokemonId);
      return {
        ...totals(player, maxGames),
        pokemonId,
        teamId,
        slot,
        playerId: `${teamId}:${pokemonId}`,
        teamName: teams[teamId].name,
      };
    });
  };
  const inputs: SeasonReplayArchive = {
    modelVersion: 1,
    seasonModel: row.seasonModel as SeasonReplayArchive["seasonModel"],
    teams,
    regularPlayers: parsedPlayers(row.regularPlayers as unknown[], 82),
    playoffPlayers: parsedPlayers(row.playoffPlayers as unknown[], 28),
    playedGames,
    playoffs: structuredClone(row.playoffs) as SeasonReplayArchive["playoffs"],
  };
  if (preliminary) return inputs;
  const expected =
      verified?.regular ??
      replayArchivedSeasonSync({ ...season, replay: inputs }),
    league = expected.league!;
  if (
    JSON.stringify(row.regularPlayers) !== JSON.stringify(league.players) ||
    JSON.stringify(season.standings) !== JSON.stringify(league.standings)
  )
    return fail();
  if (
    season.awards.some((award, index) =>
      Object.entries(award).some(
        ([key, value]) =>
          league.awards[index][key as keyof typeof award] !== value,
      ),
    )
  )
    return fail();
  const honorIds = (honors: HistoricalHonor[]) =>
    honors.map((honor) => `${honor.teamId}:${honor.pokemonId}`);
  if (
    JSON.stringify(honorIds(season.allLeague)) !==
      JSON.stringify(league.allLeague) ||
    JSON.stringify(honorIds(season.allDefense)) !==
      JSON.stringify(league.allDefense)
  )
    return fail();
  const playoffs =
    verified?.playoffs ??
    replayPlayoffs(
      league,
      season.seasonSeed,
      gameCount,
      bracket.playedGames as SeasonReplayArchive["playedGames"] | undefined,
    );
  if (
    JSON.stringify(bracket) !== JSON.stringify(playoffs) ||
    JSON.stringify(row.playoffPlayers) !== JSON.stringify(playoffs.players)
  )
    return fail();
  const finals = playoffs.series[14];
  if (
    playoffs.championId !== season.championId ||
    JSON.stringify(playoffs.finalsMvp) !== JSON.stringify(season.finalsMvp) ||
    season.runnerUpId !==
      (finals.higherSeedId === playoffs.championId
        ? finals.lowerSeedId
        : finals.higherSeedId) ||
    season.runnerUpWins !==
      (finals.higherSeedId === playoffs.championId
        ? finals.lowerSeedWins
        : finals.higherSeedWins)
  )
    return fail();
  return {
    ...inputs,
    regularPlayers: league.players,
    playoffPlayers: playoffs.players,
    playoffs,
  };
}
function totals(value: unknown, maxGames: number): CareerTotals {
  const row = object(value),
    result = {} as CareerTotals;
  for (const key of CAREER_KEYS)
    result[key] =
      key === "minutes"
        ? number(row[key], 0, maxGames * 1000)
        : integer(
            row[key],
            key === "plusMinus" ? -maxGames * 10000 : 0,
            maxGames * 10000,
          );
  if (
    !Number.isSafeInteger(result.minutes * 8) ||
    result.gamesPlayed > maxGames ||
    result.gamesStarted > result.gamesPlayed ||
    result.doubleDoubles > result.gamesPlayed ||
    result.tripleDoubles > result.doubleDoubles ||
    result.playerOfGame > result.gamesPlayed ||
    result.fgm > result.fga ||
    result.threePM > result.threePA ||
    result.ftm > result.fta ||
    result.rimFgm > result.rimFga ||
    result.midFgm > result.midFga ||
    result.fgm !== result.threePM + result.rimFgm + result.midFgm ||
    result.fga !== result.threePA + result.rimFga + result.midFga ||
    result.points !== result.fgm * 2 + result.threePM + result.ftm ||
    result.highPoints > result.points ||
    result.highPoints * result.gamesPlayed < result.points ||
    (result.gamesPlayed === 0 && CAREER_KEYS.some((key) => result[key] !== 0))
  )
    return fail();
  return result;
}
function careers(
  value: unknown,
  history: FranchiseSeason[],
  leagueIds: number[],
): CareerPlayer[] {
  const seen = new Set<number>();
  const playoffTeams = history.map((year) => qualifiers(year.standings));
  const rows = array(value, leagueIds.length).map((value) => {
    const row = object(value),
      pokemonId = integer(row.pokemonId, 1, 1025);
    const appearances = history.filter((year) =>
      year.rosters.some((roster) => roster.includes(pokemonId)),
    );
    if (
      seen.has(pokemonId) ||
      !leagueIds.includes(pokemonId) ||
      row.seasons !== appearances.length
    )
      return fail();
    seen.add(pokemonId);
    const playedTeams = [
      ...new Set(
        appearances.map((year) =>
          year.rosters.findIndex((roster) => roster.includes(pokemonId)),
        ),
      ),
    ];
    const teamIds = array(row.teamIds, playedTeams.length).map((id, index) => {
      if (id !== playedTeams[index]) return fail();
      return playedTeams[index];
    });
    let starts = 0,
      regularGames = 0,
      qualifiedYears = 0,
      minimumPlayoffGames = 0;
    const detailedRegular: LeaguePlayer[] = [],
      detailedPlayoffs: LeaguePlayer[] = [];
    for (const [index, year] of history.entries()) {
      const teamId = year.rosters.findIndex((roster) =>
        roster.includes(pokemonId),
      );
      if (teamId < 0) continue;
      const detail = year.replay?.regularPlayers.find(
        (player) => player.pokemonId === pokemonId,
      );
      if (detail) {
        starts += detail.gamesStarted;
        regularGames += detail.gamesPlayed;
        detailedRegular.push(detail);
      } else {
        regularGames += 82;
        if (year.rosters[teamId].indexOf(pokemonId) < 5) starts += 82;
      }
      const postseason = year.replay?.playoffPlayers.find(
        (player) => player.pokemonId === pokemonId,
      );
      if (postseason) detailedPlayoffs.push(postseason);
      if (playoffTeams[index].includes(teamId)) {
        qualifiedYears++;
        minimumPlayoffGames += year.replay
          ? (postseason?.gamesPlayed ?? 0)
          : teamId === year.championId || teamId === year.runnerUpId
            ? 16
            : 4;
      }
    }
    const regular = totals(row.regular, appearances.length * 82),
      playoffs = totals(row.playoffs, qualifiedYears * 28);
    if (
      regular.gamesPlayed !== regularGames ||
      regular.gamesStarted !== starts ||
      playoffs.gamesPlayed < minimumPlayoffGames
    )
      return fail();
    const detailed = (players: LeaguePlayer[], total: CareerTotals) => {
      for (const key of CAREER_KEYS) {
        const sum =
          key === "highPoints"
            ? Math.max(0, ...players.map((player) => player[key]))
            : players.reduce((sum, player) => sum + player[key], 0);
        if (
          appearances.every((year) => year.replay)
            ? total[key] !== sum
            : key !== "plusMinus" && total[key] < sum
        )
          return fail();
      }
    };
    detailed(detailedRegular, regular);
    detailed(detailedPlayoffs, playoffs);
    return {
      pokemonId,
      seasons: appearances.length,
      teamIds,
      regular,
      playoffs,
    };
  });
  if (
    rows.reduce((sum, row) => sum + row.regular.points, 0) !==
      history.reduce(
        (sum, year) =>
          sum + year.standings.reduce((sum, row) => sum + row.pointsFor, 0),
        0,
      ) ||
    rows.reduce((sum, row) => sum + row.regular.gamesStarted, 0) !==
      history.reduce(
        (sum, year) =>
          sum +
          (year.replay
            ? year.replay.regularPlayers.reduce(
                (sum, player) => sum + player.gamesStarted,
                0,
              )
            : 30 * 82 * 5),
        0,
      ) ||
    rows.reduce((sum, row) => sum + row.regular.playerOfGame, 0) !==
      history.length * 1230 ||
    rows.reduce((sum, row) => sum + row.regular.plusMinus, 0) !== 0 ||
    rows.reduce((sum, row) => sum + row.playoffs.plusMinus, 0) !== 0
  )
    return fail();
  for (const phase of ["regular", "playoffs"] as const) {
    const played = rows.reduce((sum, row) => sum + row[phase].playerOfGame, 0);
    const detailedYears = history.filter((year) => year.replay);
    const detailedGames = detailedYears.reduce(
      (sum, year) =>
        sum +
        (phase === "regular"
          ? 1230
          : year.replay!.playoffs.series.reduce(
              (sum, series) => sum + series.games.length,
              0,
            )),
      0,
    );
    const detailedPlayers = detailedYears.flatMap((year) =>
      phase === "regular"
        ? year.replay!.regularPlayers
        : year.replay!.playoffPlayers,
    );
    const expectedAppearances =
      (played - detailedGames) * 16 +
      detailedPlayers.reduce((sum, player) => sum + player.gamesPlayed, 0);
    const expectedStarts =
      (played - detailedGames) * 10 +
      detailedPlayers.reduce((sum, player) => sum + player.gamesStarted, 0);
    const minutes = rows.reduce((sum, row) => sum + row[phase].minutes, 0);
    if (
      !Number.isSafeInteger(played) ||
      rows.reduce((sum, row) => sum + row[phase].gamesPlayed, 0) !==
        expectedAppearances ||
      minutes < played * 480 ||
      (minutes - played * 480) % 50 !== 0 ||
      rows.reduce((sum, row) => sum + row[phase].playerOfGame, 0) !== played ||
      rows.reduce((sum, row) => sum + row[phase].gamesStarted, 0) !==
        expectedStarts
    )
      return fail();
    if (
      phase === "playoffs" &&
      (played < history.length * 60 || played > history.length * 105)
    )
      return fail();
  }
  return rows;
}
function compareRosters(actual: number[][], expected: number[][]): void {
  if (actual.some((row, index) => !sameMembers(row, expected[index]))) fail();
}
function verifyCurrentArchive(franchise: Franchise, run: Run): void {
  const league = run.result?.league,
    playoffs = run.playoffs,
    latest = franchise.history.at(-1)!;
  if (
    !league ||
    !playoffs ||
    playoffs.championId === null ||
    !playoffs.finalsMvp
  )
    return fail();
  const final = playoffs.series[14],
    runnerUpId =
      final.higherSeedId === playoffs.championId
        ? final.lowerSeedId
        : final.higherSeedId;
  if (
    latest.seasonSeed !== run.seasonSeed ||
    latest.championId !== playoffs.championId ||
    latest.runnerUpId !== runnerUpId ||
    latest.runnerUpWins !==
      (final.higherSeedId === playoffs.championId
        ? final.lowerSeedWins
        : final.higherSeedWins) ||
    JSON.stringify(latest.finalsMvp) !== JSON.stringify(playoffs.finalsMvp)
  )
    return fail();
  compareRosters(
    latest.rosters,
    league.teams.map((team) => ROSTER_SLOTS.map((slot) => team.roster[slot]!)),
  );
  if (JSON.stringify(latest.standings) !== JSON.stringify(league.standings))
    return fail();
  const selected = (playerId: string) => {
    const player = league.players.find(
      (player) => player.playerId === playerId,
    );
    if (!player) return fail();
    return { pokemonId: player.pokemonId, teamId: player.teamId };
  };
  if (
    JSON.stringify(latest.allLeague) !==
      JSON.stringify(league.allLeague.map(selected)) ||
    JSON.stringify(latest.allDefense) !==
      JSON.stringify(league.allDefense.map(selected))
  )
    return fail();
  for (const award of latest.awards) {
    const source = league.awards.find((item) => item.id === award.id);
    if (
      !source ||
      Object.entries(award).some(
        ([key, value]) => source[key as keyof typeof source] !== value,
      )
    )
      return fail();
  }
  const byId = new Map(
    franchise.careers.map((career) => [career.pokemonId, career]),
  );
  const check = (players: LeaguePlayer[], phase: "regular" | "playoffs") => {
    for (const player of players) {
      const total = byId.get(player.pokemonId)![phase];
      for (const key of CAREER_KEYS) {
        if (
          franchise.year === 1
            ? total[key] !== player[key]
            : key !== "plusMinus" && total[key] < player[key]
        )
          return fail();
      }
    }
  };
  check(league.players, "regular");
  check(playoffs.players, "playoffs");
}

/** Archived years are bounded summaries; only the active season is replayed. */
export function validateFranchise(
  value: unknown,
  run: Run,
  preliminary = false,
  verifiedArchives?: VerifiedArchives,
): Franchise {
  const row = object(value),
    year = integer(row.year, 1, FRANCHISE_MAX_YEARS);
  if (
    ![1, 2, 3].includes(row.modelVersion as number) ||
    (row.phase !== "season" && row.phase !== "offseason") ||
    (row.phase === "season" && year < 2)
  )
    return fail();
  const teams = validateLeagueTeams(row.teams, run.includeLegends),
    leagueIds = teams.flatMap((team) => Object.values(team.roster) as number[]);
  const historyCount = row.phase === "offseason" ? year : year - 1;
  const history = array(row.history, historyCount).map((entry, index) =>
    archivedSeason(
      entry,
      index,
      run.includeLegends,
      Object.hasOwn(row, "rookieDrafts") ? undefined : leagueIds,
      preliminary,
      verifiedArchives?.get(index + 1),
    ),
  );
  if (
    row.modelVersion !== 3 &&
    (history.some((season) => season.replay) ||
      Object.hasOwn(row, "trainingPlans") ||
      Object.hasOwn(row, "rookieDrafts") ||
      teams.some((team) => team.rotationPlan) ||
      run.seasonProgress ||
      run.rotationPlan)
  )
    return fail();
  const parsedCareers = careers(row.careers, history, [
    ...new Set(history.flatMap((season) => season.rosters.flat())),
  ]);
  if (!Array.isArray(row.trades) || row.trades.length > FRANCHISE_MAX_TRADES)
    return fail();
  if (
    row.modelVersion === 1 &&
    (Object.hasOwn(row, "offseasons") ||
      teams.some((team) => team.development) ||
      run.leagueTeams?.some((team) => team.development))
  )
    return fail();
  if (
    (row.modelVersion === 2 || Object.hasOwn(row, "offseasons")) &&
    teams.some((team) => !team.development)
  )
    return fail();
  let previousYear = 1;
  const trades = row.trades.map((value): FranchiseTrade => {
    const trade = object(value),
      tradeYear = integer(trade.year, previousYear, historyCount);
    previousYear = tradeYear;
    const cpu = trade.source === "cpu";
    const packaged = Object.hasOwn(trade, "packageVersion");
    if (
      packaged
        ? row.modelVersion !== 3 || trade.packageVersion !== 1
        : Object.hasOwn(trade, "giveIds") || Object.hasOwn(trade, "receiveIds")
    )
      return fail();
    if (Object.hasOwn(trade, "source") && !cpu) return fail();
    if (
      row.modelVersion === 1 &&
      ["source", "fromTeamId", "reason"].some((key) =>
        Object.hasOwn(trade, key),
      )
    )
      return fail();
    if (
      !cpu &&
      (Object.hasOwn(trade, "fromTeamId") ||
        (!packaged && Object.hasOwn(trade, "reason")))
    )
      return fail();
    const teamId = integer(trade.teamId, 1, 29),
      fromTeamId = cpu ? integer(trade.fromTeamId, 1, 29) : 0;
    if (teamId === fromTeamId) return fail();
    const giveId = species(trade.giveId, run.includeLegends),
      receiveId = species(trade.receiveId, run.includeLegends);
    let giveIds: number[] | undefined, receiveIds: number[] | undefined;
    if (packaged) {
      if (
        !Array.isArray(trade.giveIds) ||
        trade.giveIds.length < 1 ||
        trade.giveIds.length > 3 ||
        !Array.isArray(trade.receiveIds) ||
        trade.receiveIds.length !== trade.giveIds.length
      )
        return fail();
      giveIds = trade.giveIds.map((id) => species(id, run.includeLegends));
      receiveIds = trade.receiveIds.map((id) =>
        species(id, run.includeLegends),
      );
      if (
        giveIds[0] !== giveId ||
        receiveIds[0] !== receiveId ||
        new Set([...giveIds, ...receiveIds]).size !== giveIds.length * 2 ||
        giveIds.some((id, index) => index > 0 && id <= giveIds![index - 1]) ||
        receiveIds.some(
          (id, index) => index > 0 && id <= receiveIds![index - 1],
        )
      )
        return fail();
    }
    return {
      year: tradeYear,
      teamId,
      ...(cpu
        ? { source: "cpu" as const, fromTeamId, reason: text(trade.reason) }
        : {}),
      giveId,
      receiveId,
      ...(packaged
        ? {
            packageVersion: 1 as const,
            giveIds: giveIds!,
            receiveIds: receiveIds!,
            ...(!cpu && Object.hasOwn(trade, "reason")
              ? { reason: text(trade.reason) }
              : {}),
          }
        : {}),
    };
  });
  const developmentHistory =
    row.modelVersion === 2 || Object.hasOwn(row, "offseasons")
      ? reports(
          row.offseasons,
          history,
          trades,
          historyCount,
          row.modelVersion === 3 && row.phase === "offseason",
        )
      : undefined;
  if (Object.hasOwn(row, "rookieDrafts") && row.rookieDrafts === undefined)
    return fail();
  const { drafts, expected } = validateRosterTransactions(
    row.rookieDrafts,
    history,
    trades,
    teams.map((team) => ROSTER_SLOTS.map((slot) => team.roster[slot]!)),
    run.includeLegends,
    year,
    row.phase,
    developmentHistory?.reports,
  );
  if (developmentHistory)
    for (const team of teams)
      sameDevelopment(
        team.development,
        developmentHistory.cumulative,
        Object.values(team.roster) as number[],
      );
  if (!developmentHistory && teams.some((team) => team.development))
    return fail();
  const offsets: PlayerDevelopment = {};
  for (const archived of history) {
    if (archived.replay)
      for (const team of archived.replay.teams) {
        const hasEarlierReport = developmentHistory?.reports.some(
          (report) => report.year < archived.year,
        );
        if (hasEarlierReport)
          sameDevelopment(
            team.development,
            offsets,
            Object.values(team.roster) as number[],
          );
        else if (team.development) return fail();
      }
    const report = developmentHistory?.reports.find(
      (report) => report.year === archived.year,
    );
    for (const player of report?.players ?? [])
      for (const skill of DEVELOPMENT_SKILLS) {
        offsets[player.pokemonId] ??= {};
        offsets[player.pokemonId]![skill] =
          (offsets[player.pokemonId]?.[skill] ?? 0) +
          (player.changes[skill] ?? 0);
      }
  }
  if (year === 1 ? run.leagueTeams !== undefined : !run.leagueTeams)
    return fail();
  if (run.leagueTeams) {
    const fixed = run.leagueTeams.map((team) =>
      ROSTER_SLOTS.map((slot) => team.roster[slot]!),
    );
    compareRosters(
      fixed,
      row.phase === "offseason" ? history.at(-1)!.rosters : expected,
    );
    if (developmentHistory) {
      const prior =
        row.phase === "offseason"
          ? developmentHistory.previous
          : developmentHistory.cumulative;
      const shouldBeDeveloped = developmentHistory.reports[0].year < year;
      for (const team of run.leagueTeams) {
        if (shouldBeDeveloped)
          sameDevelopment(
            team.development,
            prior,
            Object.values(team.roster) as number[],
          );
        else if (team.development) return fail();
      }
    }
    if (!sameMembers(Object.values(run.roster) as number[], fixed[0]))
      return fail();
  }
  const franchise: Franchise = {
    modelVersion: row.modelVersion as Franchise["modelVersion"],
    year,
    phase: row.phase,
    teams,
    careers: parsedCareers,
    history,
    trades,
    ...(drafts ? { rookieDrafts: drafts } : {}),
    ...(developmentHistory ? { offseasons: developmentHistory.reports } : {}),
    ...(Object.hasOwn(row, "trainingPlans")
      ? {
          trainingPlans: validateTrainingPlans(
            row.trainingPlans,
            teams[0].roster,
          ),
        }
      : {}),
  };
  if (!preliminary) {
    if (year === 1 && run.result?.modelVersion !== 3) return fail();
    if (
      year > 1 &&
      run.result &&
      run.result.modelVersion !== 6 &&
      run.result.modelVersion !== (run.leagueTeams?.[0].development ? 5 : 4)
    )
      return fail();
    if (row.phase === "offseason") verifyCurrentArchive(franchise, run);
    else if (run.result?.league)
      compareRosters(
        run.result.league.teams.map((team) =>
          ROSTER_SLOTS.map((slot) => team.roster[slot]!),
        ),
        expected,
      );
  }
  return franchise;
}
