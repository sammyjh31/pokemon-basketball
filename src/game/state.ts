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
import { enterOffseason, startFranchiseSeason, applyTrade } from "./franchise";
export type GameAction =
  | { type: "ENTER_OFFSEASON" }
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
  | { type: "NEW_RUN"; mode: Mode; includeLegends: boolean; seed: number };
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
  if (action.type === "ENTER_OFFSEASON") return enterOffseason(state);
  if (action.type === "START_FRANCHISE_SEASON")
    return startFranchiseSeason(state, action.seed);
  if (action.type === "TRADE")
    return applyTrade(state, action.teamId, action.giveId, action.receiveId);
  if (action.type === "NEW_RUN")
    return {
      version: 3,
      records: state.records,
      run: createRun(action.mode, action.includeLegends, action.seed),
    };
  if (action.type === "APPLY_PLAYOFFS") {
    if (
      action.source !== run ||
      ![3, 4].includes(run.result?.modelVersion ?? 0) ||
      state.franchise?.phase === "offseason" ||
      !run.result?.league
    )
      return state;
    return { ...state, run: { ...run, playoffs: action.playoffs } };
  }
  if (run.result) return state;
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
      ? { ...state, run: { ...run, rotation: action.rotation } }
      : state;
  if (action.type === "SET_LINEUP") {
    if (run.mode !== "free" || !validRoster(action.roster, run.includeLegends))
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
      run: { ...run, result },
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
