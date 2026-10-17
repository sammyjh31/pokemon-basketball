import { mergeAbilityActivations } from "./abilities";
import { projectedCoaches } from "./coachOffice";
import { reviewFranchiseCoaches } from "./coachFranchise";
import { assignLeagueCoaches } from "./trainerCoaches";
import { captureRivalScouting } from "./rivalScouting";
import { processCpuFreeAgency } from "./freeAgency";
import type { TradePackage } from "./tradeTypes";
import { evaluateTradePackage } from "./tradeMarket";
import { exchangePackage } from "./rosterTrades";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "./draft";
import { captureSeasonReplay } from "./archive";
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
import { exchangePlayers } from "./rosterTrades";
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
    [1, 2, 3].includes(franchise.modelVersion) &&
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
  const result = {} as CareerTotals;
  for (const key of CAREER_KEYS) result[key] = 0;
  return result;
}

function addTotals(target: CareerTotals, player: LeaguePlayer) {
  mergeAbilityActivations(target, player);
  for (const key of CAREER_KEYS)
    target[key] =
      key === "highPoints"
        ? Math.max(target[key], player[key])
        : target[key] + player[key];
}

function addSeason(careers: CareerPlayer[], run: Run): CareerPlayer[] {
  const league = (run.result ?? run.seasonProgress?.result)?.league;
  if (!league) return structuredClone(careers);
  const result = structuredClone(careers);
  const bySpecies = new Map(result.map((player) => [player.pokemonId, player]));
  const played = new Set<number>();
  for (const player of league.players) {
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
    [4, 5, 6].includes(
      (run?.result ?? run?.seasonProgress?.result)?.modelVersion ?? 0,
    ) &&
    (run?.result ?? run?.seasonProgress?.result)?.league &&
    sameMembership(
      franchise.teams,
      (run!.result ?? run!.seasonProgress!.result)!.league!.teams,
    )
  )
    return addSeason(franchise.careers, run!);
  return structuredClone(franchise.careers);
}

function seasonArchive(run: Run, year: number): FranchiseSeason | null {
  const league = run.result?.league,
    playoffs = run.playoffs;
  if (
    !league ||
    !playoffs ||
    ![1, 2].includes(playoffs.modelVersion) ||
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
  const rivalScouting = captureRivalScouting(league, playoffs);
  return {
    ...(rivalScouting ? { rivalScouting } : {}),
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
        ![4, 5, 6].includes(run.result?.modelVersion ?? 0) ||
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
  if (previous?.modelVersion === 3) archive.replay = captureSeasonReplay(run);
  const franchise: Franchise = {
    ...(previous?.coachOffice ? { coachOffice: previous.coachOffice } : {}),
    modelVersion: previous?.modelVersion ?? 1,
    year,
    phase: "offseason",
    teams,
    careers: addSeason(previous?.careers ?? [], run),
    history: [...(previous?.history ?? []), archive],
    trades: previous?.trades ?? [],
    ...(previous?.rookieDrafts ? { rookieDrafts: previous.rookieDrafts } : {}),
    ...(previous?.freeAgency ? { freeAgency: previous.freeAgency } : {}),
    ...(previous?.offseasons ? { offseasons: previous.offseasons } : {}),
    ...(previous?.trainingPlans
      ? { trainingPlans: previous.trainingPlans }
      : {}),
  };
  return { ...state, franchise };
}

export function startFranchiseSeason(
  state: GameState,
  seed: number,
): GameState {
  let franchise = state.franchise;
  if (
    !franchise ||
    !validPhase(franchise, "offseason") ||
    !Number.isSafeInteger(seed) ||
    franchise.year >= FRANCHISE_MAX_YEARS ||
    (franchise.rookieDrafts !== undefined &&
      (franchise.rookieDrafts.at(-1)?.year !== franchise.year ||
        !franchise.rookieDrafts.at(-1)?.complete))
  )
    return state;
  const reviewed = reviewFranchiseCoaches(state);
  const appointments = projectedCoaches(
    franchise.teams,
    reviewed.franchise!.coachOffice,
    franchise.year,
  );
  if (
    franchise.teams.some((t) => t.coach) &&
    appointments.some((t) => !t.coach)
  )
    return state;
  const prepared = processCpuFreeAgency(reviewed);
  franchise = prepared.franchise!;
  let teams: LeagueTeam[];
  try {
    teams = validateLeagueTeams(
      projectedCoaches(franchise.teams, franchise.coachOffice, franchise.year),
      state.run.includeLegends,
    );
  } catch {
    return state;
  }
  // Type rules roll forward only at the season boundary. Historical teams stay frozen.
  teams = teams.map((team) => ({
    ...team,
    typeMatchupsVersion: 1 as const,
    typeTacticsVersion: 1 as const,
    abilityVersion: 1 as const,
    evaluationVersion: 1 as const,
    courtVersion: 1 as const,
    matchupVersion: 1 as const,
    possessionVersion: 1 as const,
  }));
  if (franchise.pendingCoach)
    teams = assignLeagueCoaches(
      teams,
      seed,
      new Map([[0, franchise.pendingCoach]]),
    );
  const user = teams[0];
  const run: Run = {
    ...createRun(state.run.mode, state.run.includeLegends, seed),
    ...(user.coach ? { coach: user.coach } : {}),
    roster: { ...user.roster },
    tactic: user.tactic,
    rotation: user.rotation,
    defense: user.defense,
    offerIds: [],
    leagueTeams: teams,
    ...(user.rotationPlan
      ? { rotationPlan: structuredClone(user.rotationPlan) }
      : {}),
    ...(franchise.modelVersion === 3
      ? {
          seasonProgress: {
            modelVersion: 1 as const,
            completedRounds: 0,
            playedGames: {},
          },
        }
      : {}),
  };
  const { pendingCoach: _hiredCoach, ...continuedFranchise } = franchise;
  return {
    ...state,
    run,
    franchise: {
      ...continuedFranchise,
      teams: structuredClone(teams),
      year: franchise.year + 1,
      phase: "season",
    },
  };
}

/** Save validators can normalize property order without changing the recorded data. */
function sameSnapshot(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    !a ||
    !b ||
    typeof a !== "object" ||
    typeof b !== "object" ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const left = a as Record<string, unknown>,
    right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) => Object.hasOwn(right, key) && sameSnapshot(left[key], right[key]),
    )
  );
}

/** Opt into connected history without changing the older model-1/2 helpers. */
export function archiveFranchiseSeason(state: GameState): GameState {
  const next = enterOffseason(state);
  if (
    !next.franchise ||
    (next === state &&
      (next.franchise.phase !== "offseason" ||
        next.franchise.history.at(-1)?.replay))
  )
    return state;
  const source = seasonArchive(next.run, next.franchise.year);
  const previousSummary = { ...next.franchise.history.at(-1)! };
  delete previousSummary.replay;
  // Enrich old archives without inventing recruiting knowledge they never stored.
  if (source && !Object.hasOwn(previousSummary, "rivalScouting"))
    delete source.rivalScouting;
  if (!source || !sameSnapshot(source, previousSummary)) return state;
  const history = [...next.franchise.history];
  history[history.length - 1] = {
    ...history.at(-1)!,
    replay: captureSeasonReplay(next.run),
  };
  return {
    ...next,
    franchise: { ...next.franchise, modelVersion: 3, history },
  };
}

export function startInteractiveFranchiseSeason(
  state: GameState,
  seed: number,
): GameState {
  const next = startFranchiseSeason(state, seed);
  if (next === state || !next.franchise) return state;
  return {
    ...next,
    franchise: {
      ...next.franchise,
      modelVersion: 3,
      history:
        archiveFranchiseSeason(state).franchise?.history ??
        next.franchise.history,
    },
    run: {
      ...next.run,
      seasonProgress: { modelVersion: 1, completedRounds: 0, playedGames: {} },
    },
  };
}

export function evaluateTrade(
  franchise: Franchise,
  teamId: number,
  giveId: number,
  receiveId: number,
): TradeEvaluation {
  if (franchise.teams[0]?.evaluationVersion === 1)
    return evaluateTradePackage(franchise, {
      teamId,
      giveIds: [giveId],
      receiveIds: [receiveId],
    });
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
  if (
    franchise.rookieDrafts?.some(
      (draft) => draft.year === franchise.year && !draft.complete,
    )
  )
    return reject("Complete the current rookie draft before trading.");
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
    ...POSITIONS.map((position) =>
      positionRating(outgoing, position, user.development?.[giveId]),
    ),
  );
  values.incomingValue = Math.max(
    ...POSITIONS.map((position) =>
      positionRating(incoming, position, partner.development?.[receiveId]),
    ),
  );
  values.partnerBefore = teamRatings(
    partner.roster,
    partner.tactic,
    partner.rotation,
    partner.development,
    partner.rotationPlan,
  ).overall;
  values.partnerAfter = teamRatings(
    { ...partner.roster, [receiveSlot]: giveId },
    partner.tactic,
    partner.rotation,
    partner.development
      ? { ...partner.development, [giveId]: user.development?.[giveId] ?? {} }
      : undefined,
    partner.rotationPlan,
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
  const teams = exchangePlayers(franchise.teams, 0, teamId, giveId, receiveId);
  return {
    ...state,
    franchise: {
      ...franchise,
      teams,
      ...(franchise.trainingPlans
        ? {
            trainingPlans: Object.fromEntries(
              Object.entries(franchise.trainingPlans).filter(
                ([id]) => Number(id) !== giveId,
              ),
            ),
          }
        : {}),
      trades: [
        ...franchise.trades,
        { year: franchise.year, teamId, giveId, receiveId },
      ],
    },
  };
}

/** The preview and execution use the same current ownership and coach evaluation. */
export function applyTradePackage(
  state: GameState,
  offer: TradePackage,
): GameState {
  const f = state.franchise;
  if (!f || !offer) return state;
  const evaluation = evaluateTradePackage(f, offer);
  if (!evaluation.accepted) return state;
  const giveIds = [...offer.giveIds].sort((a, b) => a - b),
    receiveIds = [...offer.receiveIds].sort((a, b) => a - b);
  const teams = exchangePackage(f.teams, 0, offer.teamId, giveIds, receiveIds);
  return {
    ...state,
    franchise: {
      ...f,
      modelVersion: 3,
      teams,
      ...(f.trainingPlans
        ? {
            trainingPlans: Object.fromEntries(
              Object.entries(f.trainingPlans).filter(
                ([id]) => !giveIds.includes(Number(id)),
              ),
            ),
          }
        : {}),
      trades: [
        ...f.trades,
        {
          year: f.year,
          teamId: offer.teamId,
          giveId: giveIds[0],
          receiveId: receiveIds[0],
          packageVersion: 1,
          giveIds,
          receiveIds,
          reason: evaluation.reason,
        },
      ],
    },
  };
}
