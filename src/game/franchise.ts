import { POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "./draft";
import { validateLeagueTeams } from "./franchiseValidation";
import {
  CAREER_KEYS,
  FRANCHISE_MAX_YEARS,
  FRANCHISE_MAX_TRADES,
  type CareerPlayer,
  type CareerTotals,
  type Franchise,
  type FranchiseSeason,
  type TradeEvaluation,
} from "./franchiseTypes";
import { positionRating, teamRatings } from "./ratings";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type GameState,
  type LeaguePlayer,
  type LeagueTeam,
  type Run,
} from "./types";

function validPhase(franchise: Franchise, phase: Franchise["phase"]) {
  return (
    franchise.modelVersion === 1 &&
    franchise.phase === phase &&
    Number.isInteger(franchise.year) &&
    franchise.year >= 1 &&
    franchise.history.length === franchise.year - Number(phase === "season") &&
    franchise.history.every((season, index) => season.year === index + 1)
  );
}

function uniqueLeague(teams: LeagueTeam[]) {
  const ids = teams.flatMap((team) =>
    ROSTER_SLOTS.map((slot) => team.roster[slot]),
  );
  return (
    teams.length === 30 &&
    teams.every((team, index) => team.id === index) &&
    ids.length === 240 &&
    new Set(ids).size === 240 &&
    ids.every((id) => id !== null && POKEMON_BY_ID.has(id))
  );
}

function sameMembership(a: LeagueTeam[], b: LeagueTeam[]) {
  return (
    a.length === b.length &&
    a.every(
      (team, index) =>
        team.id === b[index].id &&
        ROSTER_SLOTS.every((slot) =>
          Object.values(b[index].roster).includes(team.roster[slot]),
        ),
    )
  );
}

function emptyTotals(): CareerTotals {
  return Object.fromEntries(CAREER_KEYS.map((key) => [key, 0])) as CareerTotals;
}

function addTotals(target: CareerTotals, player: LeaguePlayer) {
  for (const key of CAREER_KEYS)
    target[key] =
      key === "highPoints"
        ? Math.max(target[key], player[key])
        : target[key] + player[key];
}

function addSeason(careers: CareerPlayer[], run: Run): CareerPlayer[] {
  const result = structuredClone(careers);
  const bySpecies = new Map(result.map((player) => [player.pokemonId, player]));
  const played = new Set<number>();
  for (const player of run.result!.league!.players) {
    let career = bySpecies.get(player.pokemonId);
    if (!career) {
      career = {
        pokemonId: player.pokemonId,
        seasons: 0,
        teamIds: [],
        regular: emptyTotals(),
        playoffs: emptyTotals(),
      };
      bySpecies.set(player.pokemonId, career);
      result.push(career);
    }
    if (!played.has(player.pokemonId)) career.seasons++;
    played.add(player.pokemonId);
    if (!career.teamIds.includes(player.teamId))
      career.teamIds.push(player.teamId);
    addTotals(career.regular, player);
  }
  for (const player of run.playoffs?.players ?? []) {
    const career = bySpecies.get(player.pokemonId);
    if (career && played.has(player.pokemonId))
      addTotals(career.playoffs, player);
  }
  return result.sort((a, b) => a.pokemonId - b.pokemonId);
}

/** Derived totals include the active year only until that year is archived. */
export function careerPlayers(franchise: Franchise, run?: Run): CareerPlayer[] {
  if (
    validPhase(franchise, "season") &&
    run?.result?.modelVersion === 4 &&
    run.result.league &&
    sameMembership(franchise.teams, run.result.league.teams)
  )
    return addSeason(franchise.careers, run);
  return structuredClone(franchise.careers);
}

function seasonArchive(run: Run, year: number): FranchiseSeason | null {
  const league = run.result?.league,
    playoffs = run.playoffs;
  if (
    !league ||
    !playoffs ||
    playoffs.modelVersion !== 1 ||
    playoffs.championId === null ||
    !playoffs.finalsMvp ||
    run.result!.games.length !== 82 ||
    league.games.length !== 1230 ||
    league.standings.length !== 30 ||
    league.standings.some(
      (row, index) => row.teamId !== index || row.wins + row.losses !== 82,
    ) ||
    league.players.length !== 240 ||
    new Set(league.players.map((player) => player.pokemonId)).size !== 240 ||
    league.players.some(
      (player) =>
        !league.teams[player.teamId] ||
        !Object.values(league.teams[player.teamId].roster).includes(
          player.pokemonId,
        ),
    ) ||
    playoffs.series.length !== 15 ||
    playoffs.series.some(
      (series) =>
        series.winnerId === null ||
        series.games.length !== series.higherSeedWins + series.lowerSeedWins ||
        Math.max(series.higherSeedWins, series.lowerSeedWins) !== 4 ||
        Math.min(series.higherSeedWins, series.lowerSeedWins) > 3 ||
        series.winnerId !==
          (series.higherSeedWins === 4
            ? series.higherSeedId
            : series.lowerSeedId),
    )
  )
    return null;
  const finals = playoffs.series.find((series) => series.round === 3);
  if (
    !finals ||
    finals.winnerId !== playoffs.championId ||
    finals.higherSeedId === null ||
    finals.lowerSeedId === null ||
    finals.higherSeedId === finals.lowerSeedId ||
    playoffs.finalsMvp.teamId !== playoffs.championId ||
    !league.teams[playoffs.championId] ||
    !Object.values(league.teams[playoffs.championId].roster).includes(
      playoffs.finalsMvp.pokemonId,
    )
  )
    return null;
  const byId = new Map(
    league.players.map((player) => [player.playerId, player]),
  );
  const honors = (ids: string[]) =>
    ids.map((id) => {
      const player = byId.get(id)!;
      return { pokemonId: player.pokemonId, teamId: player.teamId };
    });
  const selections = [...league.allLeague, ...league.allDefense];
  if (
    league.allLeague.length !== 5 ||
    league.allDefense.length !== 5 ||
    selections.some((id) => !byId.has(id)) ||
    league.awards.length !== 6 ||
    new Set(league.awards.map((award) => award.id)).size !== 6 ||
    league.awards.some(
      (award) =>
        !league.teams[award.teamId] ||
        !Object.values(league.teams[award.teamId].roster).includes(
          award.pokemonId,
        ),
    )
  )
    return null;
  return {
    year,
    seasonSeed: run.seasonSeed,
    standings: structuredClone(league.standings),
    rosters: league.teams.map((team) =>
      ROSTER_SLOTS.map((slot) => team.roster[slot]!),
    ),
    awards: league.awards.map(
      ({ id, title, pokemonId, description, value, teamId }) => ({
        id,
        title,
        pokemonId,
        description,
        value,
        teamId,
      }),
    ),
    allLeague: honors(league.allLeague),
    allDefense: honors(league.allDefense),
    championId: playoffs.championId,
    runnerUpId:
      finals.higherSeedId === playoffs.championId
        ? finals.lowerSeedId
        : finals.higherSeedId,
    runnerUpWins:
      finals.higherSeedId === playoffs.championId
        ? finals.lowerSeedWins
        : finals.higherSeedWins,
    finalsMvp: { ...playoffs.finalsMvp },
  };
}

/** Freeze one completed season while keeping its replay available this offseason. */
export function enterOffseason(state: GameState): GameState {
  const previous = state.franchise,
    run = state.run;
  if (
    previous
      ? !validPhase(previous, "season") ||
        run.result?.modelVersion !== 4 ||
        !run.leagueTeams
      : run.result?.modelVersion !== 3
  )
    return state;
  const league = run.result?.league;
  if (!league) return state;
  let teams: LeagueTeam[];
  try {
    teams = validateLeagueTeams(league.teams, run.includeLegends);
  } catch {
    return state;
  }
  if (previous && !sameMembership(previous.teams, teams)) return state;
  const year = previous?.year ?? 1,
    archive = seasonArchive(run, year);
  if (!archive) return state;
  const franchise: Franchise = {
    modelVersion: 1,
    year,
    phase: "offseason",
    teams,
    careers: addSeason(previous?.careers ?? [], run),
    history: [...(previous?.history ?? []), archive],
    trades: previous?.trades ?? [],
  };
  return { ...state, franchise };
}

export function startFranchiseSeason(
  state: GameState,
  seed: number,
): GameState {
  const franchise = state.franchise;
  if (
    !franchise ||
    !validPhase(franchise, "offseason") ||
    !Number.isSafeInteger(seed) ||
    franchise.year >= FRANCHISE_MAX_YEARS
  )
    return state;
  let teams: LeagueTeam[];
  try {
    teams = validateLeagueTeams(franchise.teams, state.run.includeLegends);
  } catch {
    return state;
  }
  const user = teams[0];
  const run: Run = {
    ...createRun(state.run.mode, state.run.includeLegends, seed),
    roster: { ...user.roster },
    tactic: user.tactic,
    rotation: user.rotation,
    defense: user.defense,
    offerIds: [],
    leagueTeams: teams,
  };
  return {
    ...state,
    run,
    franchise: { ...franchise, year: franchise.year + 1, phase: "season" },
  };
}

export function evaluateTrade(
  franchise: Franchise,
  teamId: number,
  giveId: number,
  receiveId: number,
): TradeEvaluation {
  const values = {
    outgoingValue: 0,
    incomingValue: 0,
    partnerBefore: 0,
    partnerAfter: 0,
  };
  const reject = (reason: string): TradeEvaluation => ({
    ...values,
    accepted: false,
    reason,
  });
  if (!validPhase(franchise, "offseason"))
    return reject("Trades are available only during the offseason.");
  if (franchise.trades.length >= FRANCHISE_MAX_TRADES)
    return reject(
      "This franchise has reached its 10,000-trade save limit. You can still continue playing seasons.",
    );
  if (!uniqueLeague(franchise.teams))
    return reject(
      "The league must have 30 complete rosters and 240 distinct Pokémon.",
    );
  const user = franchise.teams[0],
    partner = franchise.teams.find((team) => team.id === teamId);
  if (!partner || teamId === 0)
    return reject("Choose another club as your trade partner.");
  const giveSlot = ROSTER_SLOTS.find((slot) => user.roster[slot] === giveId);
  const receiveSlot = ROSTER_SLOTS.find(
    (slot) => partner.roster[slot] === receiveId,
  );
  if (!giveSlot || !receiveSlot || giveId === receiveId)
    return reject(
      "Choose one Pokémon from your roster and one from the selected club.",
    );
  const outgoing = POKEMON_BY_ID.get(giveId)!,
    incoming = POKEMON_BY_ID.get(receiveId)!;
  values.outgoingValue = Math.max(
    ...POSITIONS.map((position) => positionRating(outgoing, position)),
  );
  values.incomingValue = Math.max(
    ...POSITIONS.map((position) => positionRating(incoming, position)),
  );
  values.partnerBefore = teamRatings(
    partner.roster,
    partner.tactic,
    partner.rotation,
  ).overall;
  values.partnerAfter = teamRatings(
    { ...partner.roster, [receiveSlot]: giveId },
    partner.tactic,
    partner.rotation,
  ).overall;
  const abilityChange = values.outgoingValue - values.incomingValue;
  const fitChange = values.partnerAfter - values.partnerBefore;
  // A favorable slot or lineup fit cannot justify giving away a much better player.
  if (abilityChange < -6)
    return reject(
      `${partner.name} declines: ${outgoing.name}'s best-role ability is too far below ${incoming.name}'s.`,
    );
  if (fitChange < -1.25)
    return reject(
      `${partner.name} declines: this exchange weakens its rotation and positional fit.`,
    );
  if (abilityChange + 2 * fitChange < -2.5)
    return reject(
      `${partner.name} declines: the roster fit does not compensate for the loss in player ability.`,
    );
  return {
    ...values,
    accepted: true,
    reason:
      fitChange > 0.25
        ? `${partner.name} accepts: the incoming ability and roster fit improve its rotation.`
        : `${partner.name} accepts: comparable basketball ability keeps its rotation competitive.`,
  };
}

export function applyTrade(
  state: GameState,
  teamId: number,
  giveId: number,
  receiveId: number,
): GameState {
  const franchise = state.franchise;
  if (
    !franchise ||
    !evaluateTrade(franchise, teamId, giveId, receiveId).accepted
  )
    return state;
  const teams = franchise.teams.map((team) => {
    if (team.id !== 0 && team.id !== teamId) return team;
    const from = team.id === 0 ? giveId : receiveId,
      to = team.id === 0 ? receiveId : giveId;
    const slot = ROSTER_SLOTS.find(
      (candidate) => team.roster[candidate] === from,
    )!;
    const roster = { ...team.roster, [slot]: to };
    return {
      ...team,
      roster,
      ratings: teamRatings(roster, team.tactic, team.rotation),
    };
  });
  return {
    ...state,
    franchise: {
      ...franchise,
      teams,
      trades: [
        ...franchise.trades,
        { year: franchise.year, teamId, giveId, receiveId },
      ],
    },
  };
}
