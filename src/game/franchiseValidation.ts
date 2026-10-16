import { POKEMON_BY_ID } from "../data/pokemon";
import { OPPONENTS } from "../data/opponents";
import { teamRatings } from "./ratings";
import {
  CAREER_KEYS,
  FRANCHISE_MAX_YEARS,
  FRANCHISE_MAX_TRADES,
  type CareerPlayer,
  type CareerTotals,
  type Franchise,
  type FranchiseSeason,
  type HistoricalHonor,
} from "./franchiseTypes";
import {
  DEFENSE_SCHEMES,
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
  const id = integer(value, 1, 251),
    mon = POKEMON_BY_ID.get(id);
  if (!mon || (!includeLegends && mon.legendary)) return fail();
  return id;
}
function sameMembers(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}

/** Reconstruct fixed league inputs; cached ratings never influence replay. */
export function validateLeagueTeams(
  value: unknown,
  includeLegends: boolean,
): LeagueTeam[] {
  const taken = new Set<number>();
  return array(value, 30).map((value, index) => {
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
    return {
      id: index,
      name,
      roster,
      tactic,
      rotation,
      defense: row.defense as LeagueTeam["defense"],
      ratings: teamRatings(roster, tactic, rotation),
    };
  });
}

function historicalRosters(
  value: unknown,
  includeLegends: boolean,
  leagueIds: number[],
): number[][] {
  const rosters = array(value, 30).map((row) =>
    array(row, 8).map((id) => species(id, includeLegends)),
  );
  if (
    new Set(rosters.flat()).size !== 240 ||
    !sameMembers(rosters.flat(), leagueIds)
  )
    return fail();
  return rosters;
}
function honor(value: unknown, rosters: number[][]): HistoricalHonor {
  const row = object(value),
    teamId = integer(row.teamId, 0, 29),
    pokemonId = integer(row.pokemonId, 1, 251);
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
  leagueIds: number[],
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
  return {
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
  const rows = array(value, 240).map((value) => {
    const row = object(value),
      pokemonId = integer(row.pokemonId, 1, 251);
    if (
      seen.has(pokemonId) ||
      !leagueIds.includes(pokemonId) ||
      row.seasons !== history.length
    )
      return fail();
    seen.add(pokemonId);
    const playedTeams = [
      ...new Set(
        history.map((year) =>
          year.rosters.findIndex((roster) => roster.includes(pokemonId)),
        ),
      ),
    ];
    const teamIds = array(row.teamIds, playedTeams.length).map((id, index) => {
      if (id !== playedTeams[index]) return fail();
      return playedTeams[index];
    });
    let starts = 0,
      qualifiedYears = 0,
      minimumPlayoffGames = 0;
    for (const [index, year] of history.entries()) {
      const teamId = year.rosters.findIndex((roster) =>
        roster.includes(pokemonId),
      );
      if (year.rosters[teamId].indexOf(pokemonId) < 5) starts += 82;
      if (playoffTeams[index].includes(teamId)) {
        qualifiedYears++;
        minimumPlayoffGames +=
          teamId === year.championId || teamId === year.runnerUpId ? 16 : 4;
      }
    }
    const regular = totals(row.regular, history.length * 82),
      playoffs = totals(row.playoffs, qualifiedYears * 28);
    if (
      regular.gamesPlayed !== history.length * 82 ||
      regular.gamesStarted !== starts ||
      playoffs.gamesPlayed < minimumPlayoffGames
    )
      return fail();
    return { pokemonId, seasons: history.length, teamIds, regular, playoffs };
  });
  if (
    rows.reduce((sum, row) => sum + row.regular.points, 0) !==
      history.reduce(
        (sum, year) =>
          sum + year.standings.reduce((sum, row) => sum + row.pointsFor, 0),
        0,
      ) ||
    rows.reduce((sum, row) => sum + row.regular.gamesStarted, 0) !==
      history.length * 30 * 82 * 5 ||
    rows.reduce((sum, row) => sum + row.regular.playerOfGame, 0) !==
      history.length * 1230 ||
    rows.reduce((sum, row) => sum + row.regular.plusMinus, 0) !== 0 ||
    rows.reduce((sum, row) => sum + row.playoffs.plusMinus, 0) !== 0
  )
    return fail();
  for (const phase of ["regular", "playoffs"] as const) {
    const played =
      rows.reduce((sum, row) => sum + row[phase].gamesPlayed, 0) / 16;
    const minutes = rows.reduce((sum, row) => sum + row[phase].minutes, 0);
    if (
      !Number.isSafeInteger(played) ||
      minutes < played * 480 ||
      (minutes - played * 480) % 50 !== 0 ||
      rows.reduce((sum, row) => sum + row[phase].playerOfGame, 0) !== played ||
      rows.reduce((sum, row) => sum + row[phase].gamesStarted, 0) !==
        played * 10
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
): Franchise {
  const row = object(value),
    year = integer(row.year, 1, FRANCHISE_MAX_YEARS);
  if (
    row.modelVersion !== 1 ||
    (row.phase !== "season" && row.phase !== "offseason") ||
    (row.phase === "season" && year < 2)
  )
    return fail();
  const teams = validateLeagueTeams(row.teams, run.includeLegends),
    leagueIds = teams.flatMap((team) => Object.values(team.roster) as number[]);
  const historyCount = row.phase === "offseason" ? year : year - 1;
  const history = array(row.history, historyCount).map((entry, index) =>
    archivedSeason(entry, index, run.includeLegends, leagueIds),
  );
  const parsedCareers = careers(row.careers, history, leagueIds);
  if (!Array.isArray(row.trades) || row.trades.length > FRANCHISE_MAX_TRADES)
    return fail();
  let previousYear = 1;
  const trades = row.trades.map((value) => {
    const trade = object(value),
      tradeYear = integer(trade.year, previousYear, historyCount);
    previousYear = tradeYear;
    return {
      year: tradeYear,
      teamId: integer(trade.teamId, 1, 29),
      giveId: species(trade.giveId, run.includeLegends),
      receiveId: species(trade.receiveId, run.includeLegends),
    };
  });
  let tradeIndex = 0;
  let expected = history[0].rosters.map((roster) => [...roster]);
  for (const archived of history) {
    compareRosters(archived.rosters, expected);
    expected = archived.rosters.map((roster) => [...roster]);
    while (trades[tradeIndex]?.year === archived.year) {
      const trade = trades[tradeIndex++],
        giveSlot = expected[0].indexOf(trade.giveId),
        receiveSlot = expected[trade.teamId].indexOf(trade.receiveId);
      if (giveSlot < 0 || receiveSlot < 0 || trade.giveId === trade.receiveId)
        return fail();
      expected[0][giveSlot] = trade.receiveId;
      expected[trade.teamId][receiveSlot] = trade.giveId;
    }
  }
  compareRosters(
    teams.map((team) => ROSTER_SLOTS.map((slot) => team.roster[slot]!)),
    expected,
  );
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
    if (!sameMembers(Object.values(run.roster) as number[], fixed[0]))
      return fail();
  }
  const franchise: Franchise = {
    modelVersion: 1,
    year,
    phase: row.phase,
    teams,
    careers: parsedCareers,
    history,
    trades,
  };
  if (!preliminary) {
    if (year === 1 && run.result?.modelVersion !== 3) return fail();
    if (year > 1 && run.result && run.result.modelVersion !== 4) return fail();
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
