import {
  appointFranchiseCoach,
  reviewFranchiseCoaches,
} from "./coachFranchise";
import { selectTrainerCoach } from "./coachSelection";
import { POKEMON_BY_ID } from "../data/pokemon";
import { processCpuFreeAgency, signFreeAgent } from "./freeAgency";
import {
  beginRookieDraft,
  advanceRookieDraft,
  selectRookie,
} from "./rookieDraft";
import type { TradePackage } from "./tradeTypes";
import {
  updateOffseasonRoster,
  type OffseasonRosterSettings,
} from "./offseasonRoster";
import {
  autoFillBench,
  createRun,
  placePokemon,
  reroll,
  swapPositions,
} from "./draft";
import { teamRatings } from "./ratings";
import { simulateSeason } from "./season";
import {
  TACTICS,
  ROTATIONS,
  DEFENSE_SCHEMES,
  ROSTER_SLOTS,
  type DefenseScheme,
  type Run,
  type SeasonResult,
  type Tactic,
  type RotationStyle,
  type GameState,
  type Mode,
  type RosterSlot,
  type Roster,
} from "./types";
import { validRoster } from "./lineup";
import type { Playoffs } from "./playoffTypes";
import {
  archiveFranchiseSeason,
  startInteractiveFranchiseSeason,
  applyTrade,
  applyTradePackage,
} from "./franchise";
import { processOffseason } from "./offseason";
import type { RotationPlan, TrainingPlans } from "./franchiseFeatures";
import { validateRotationPlan } from "./rotationPlan";
import { validateTrainingPlans } from "./training";
export type GameAction =
  | { type: "SELECT_COACH"; id: string }
  | { type: "APPOINT_COACH"; id: string | null }
  | { type: "PROCESS_CPU_COACHES" }
  | { type: "SIGN_FREE_AGENT"; pokemonId: number; releasedId: number }
  | { type: "PROCESS_CPU_FREE_AGENCY" }
  | { type: "TRADE_PACKAGE"; offer: TradePackage }
  | { type: "BEGIN_ROOKIE_DRAFT" }
  | { type: "ADVANCE_ROOKIE_DRAFT" }
  | { type: "PICK_ROOKIE"; pokemonId: number; releasedId: number }
  | { type: "OFFSEASON_ROSTER"; settings: OffseasonRosterSettings }
  | { type: "ROTATION_PLAN"; plan: RotationPlan | undefined }
  | { type: "TRAINING_PLANS"; plans: TrainingPlans }
  | { type: "APPLY_FRANCHISE_RUN"; source: Run; run: Run }
  | { type: "ENTER_OFFSEASON" }
  | { type: "PROCESS_OFFSEASON" }
  | { type: "START_FRANCHISE_SEASON"; seed: number }
  | { type: "TRADE"; teamId: number; giveId: number; receiveId: number }
  | { type: "AUTO_BENCH" }
  | { type: "DEFENSE"; defense: DefenseScheme }
  | { type: "APPLY_SEASON"; source: Run; result: SeasonResult }
  | { type: "APPLY_PLAYOFFS"; source: Run; playoffs: Playoffs }
  | { type: "TACTIC"; tactic: Tactic }
  | { type: "ROTATION"; rotation: RotationStyle }
  | { type: "SET_LINEUP"; roster: Roster }
  | { type: "REROLL" }
  | { type: "PLACE"; pokemonId: number; position: RosterSlot }
  | { type: "SWAP"; first: RosterSlot; second: RosterSlot }
  | { type: "SIMULATE" }
  | {
      type: "NEW_RUN";
      mode: Mode;
      includeLegends: boolean;
      seed: number;
      coachDraftRequired?: true;
    }
  | { type: "LEGENDS"; includeLegends: boolean };
export function initialState(seed: number): GameState {
  return {
    version: 3,
    run: createRun("spin", true, seed),
    records: {
      spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
      free: { runs: 0, bestWins: 0, perfectSeasons: 0 },
    },
  };
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  const run = state.run;
  if (action.type === "APPOINT_COACH")
    return appointFranchiseCoach(state, action.id);
  if (action.type === "PROCESS_CPU_COACHES")
    return reviewFranchiseCoaches(state);
  if (action.type === "SELECT_COACH")
    return selectTrainerCoach(state, action.id);
  if (
    run.coachDraftRequired &&
    ["SIMULATE", "APPLY_SEASON", "APPLY_FRANCHISE_RUN"].includes(action.type)
  )
    return state;
  if (action.type === "SIGN_FREE_AGENT")
    return signFreeAgent(state, action.pokemonId, action.releasedId);
  if (action.type === "PROCESS_CPU_FREE_AGENCY")
    return processCpuFreeAgency(state);
  if (action.type === "TRADE_PACKAGE")
    return applyTradePackage(state, action.offer);
  if (action.type === "BEGIN_ROOKIE_DRAFT")
    return beginRookieDraft(processOffseason(state));
  if (action.type === "ADVANCE_ROOKIE_DRAFT") return advanceRookieDraft(state);
  if (action.type === "PICK_ROOKIE")
    return selectRookie(state, action.pokemonId, action.releasedId);
  if (action.type === "OFFSEASON_ROSTER")
    return updateOffseasonRoster(state, action.settings);
  if (action.type === "ENTER_OFFSEASON")
    return reviewFranchiseCoaches(
      processOffseason(archiveFranchiseSeason(state)),
    );
  if (action.type === "PROCESS_OFFSEASON") return processOffseason(state);
  if (action.type === "START_FRANCHISE_SEASON") {
    const next = startInteractiveFranchiseSeason(
      processOffseason(state),
      action.seed,
    );
    return next === state || next.run.coach
      ? next
      : { ...next, run: { ...next.run, coachDraftRequired: true } };
  }
  if (action.type === "TRADE")
    return applyTrade(state, action.teamId, action.giveId, action.receiveId);
  if (action.type === "TRAINING_PLANS") {
    if (!state.franchise) return state;
    try {
      const trainingPlans = validateTrainingPlans(
        action.plans,
        state.franchise.phase === "offseason"
          ? state.franchise.teams[0].roster
          : run.roster,
      );
      return {
        ...state,
        franchise: { ...state.franchise, modelVersion: 3, trainingPlans },
      };
    } catch {
      return state;
    }
  }
  if (action.type === "APPLY_FRANCHISE_RUN") {
    const rounds = action.run.seasonProgress?.completedRounds ?? 0;
    if (
      !state.franchise ||
      state.franchise.phase !== "season" ||
      action.source !== run ||
      run.result ||
      action.run.id !== run.id ||
      action.run.seasonSeed !== run.seasonSeed ||
      !Number.isInteger(rounds) ||
      rounds <= (run.seasonProgress?.completedRounds ?? 0) ||
      rounds > 82
    )
      return state;
    return {
      ...state,
      run: action.run,
      franchise: { ...state.franchise, modelVersion: 3 },
    };
  }
  // Lineup builder only changes the pool; spin offers are dealt from a fixed pool.
  if (action.type === "LEGENDS") {
    if (state.franchise || run.result || run.mode !== "free") return state;
    if (run.includeLegends === action.includeLegends) return state;
    const roster = { ...run.roster };
    if (!action.includeLegends)
      for (const slot of ROSTER_SLOTS)
        if (POKEMON_BY_ID.get(roster[slot] ?? -1)?.legendary)
          roster[slot] = null;
    return {
      ...state,
      run: { ...run, includeLegends: action.includeLegends, roster },
    };
  }
  if (action.type === "NEW_RUN")
    return {
      version: 3,
      records: state.records,
      run: {
        ...createRun(action.mode, action.includeLegends, action.seed),
        ...(action.coachDraftRequired
          ? { coachDraftRequired: true as const }
          : {}),
      },
    };
  if (action.type === "APPLY_PLAYOFFS") {
    if (
      action.source !== run ||
      ![3, 4, 5, 6].includes(run.result?.modelVersion ?? 0) ||
      state.franchise?.phase === "offseason" ||
      !run.result?.league
    )
      return state;
    return { ...state, run: { ...run, playoffs: action.playoffs } };
  }
  if (run.result) return state;
  const started = (run.seasonProgress?.completedRounds ?? 0) > 0;
  if (
    started &&
    ["SWAP", "TACTIC", "DEFENSE", "ROTATION", "ROTATION_PLAN"].includes(
      action.type,
    )
  )
    return state;
  if (action.type === "ROTATION_PLAN") {
    if (!state.franchise || state.franchise.phase !== "season") return state;
    try {
      const next = { ...run };
      if (action.plan) next.rotationPlan = validateRotationPlan(action.plan);
      else delete next.rotationPlan;
      return {
        ...state,
        run: next,
        franchise: { ...state.franchise, modelVersion: 3 },
      };
    } catch {
      return state;
    }
  }
  if (state.franchise) {
    if (state.franchise.phase !== "season") return state;
    if (["AUTO_BENCH", "SET_LINEUP", "REROLL", "PLACE"].includes(action.type))
      return state;
    if (action.type === "SWAP") {
      const next = swapPositions(
        { ...run, mode: "free" },
        action.first,
        action.second,
      );
      return { ...state, run: { ...next, mode: run.mode } };
    }
  }
  if (action.type === "AUTO_BENCH") {
    const next = autoFillBench(run);
    return next === run ? state : { ...state, run: next };
  }
  if (action.type === "DEFENSE")
    return DEFENSE_SCHEMES.includes(action.defense)
      ? { ...state, run: { ...run, defense: action.defense } }
      : state;
  if (action.type === "TACTIC")
    return TACTICS.includes(action.tactic)
      ? { ...state, run: { ...run, tactic: action.tactic } }
      : state;
  if (action.type === "ROTATION")
    return ROTATIONS.includes(action.rotation)
      ? {
          ...state,
          run: {
            ...run,
            rotation: action.rotation,
            ...(run.rotationPlan ? { rotationPlan: undefined } : {}),
          },
        }
      : state;
  if (action.type === "SET_LINEUP") {
    if (
      run.mode !== "free" ||
      !validRoster(action.roster, run.includeLegends) ||
      Object.values(action.roster).some((id) => id !== null && id > 251)
    )
      return state;
    return { ...state, run: { ...run, roster: { ...action.roster } } };
  }
  if (action.type === "SIMULATE" || action.type === "APPLY_SEASON") {
    if (action.type === "APPLY_SEASON" && action.source !== run) return state;
    if (!teamRatings(run.roster, run.tactic, run.rotation).complete)
      return state;
    const result =
        action.type === "APPLY_SEASON" ? action.result : simulateSeason(run),
      previous = state.records[run.mode];
    return {
      ...state,
      run: {
        ...run,
        result,
        ...(run.seasonProgress
          ? {
              seasonProgress: {
                modelVersion: 1 as const,
                completedRounds: 82,
                playedGames: run.seasonProgress.playedGames,
              },
            }
          : {}),
      },
      records: state.franchise
        ? state.records
        : {
            ...state.records,
            [run.mode]: {
              runs: previous.runs + 1,
              bestWins: Math.max(previous.bestWins, result.wins),
              perfectSeasons:
                previous.perfectSeasons + Number(result.wins === 82),
            },
          },
    };
  }
  const next =
    action.type === "PLACE"
      ? placePokemon(run, action.pokemonId, action.position)
      : action.type === "SWAP"
        ? swapPositions(run, action.first, action.second)
        : reroll(run);
  return next === run ? state : { ...state, run: next };
}
