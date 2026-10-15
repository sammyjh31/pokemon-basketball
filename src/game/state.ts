import { createRun, placePokemon, reroll, swapPositions } from "./draft";
import { teamRatings } from "./ratings";
import { simulateSeason } from "./season";
import type { GameState, Mode, Position, Roster } from "./types";
import { validRoster } from "./lineup";
export type GameAction =
  | { type: "SET_LINEUP"; roster: Roster }
  | { type: "REROLL" }
  | { type: "PLACE"; pokemonId: number; position: Position }
  | { type: "SWAP"; first: Position; second: Position }
  | { type: "SIMULATE" }
  | { type: "NEW_RUN"; mode: Mode; includeLegends: boolean; seed: number };
export function initialState(seed: number): GameState {
  return {
    version: 1,
    run: createRun("spin", true, seed),
    records: {
      spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
      free: { runs: 0, bestWins: 0, perfectSeasons: 0 },
    },
  };
}
export function gameReducer(state: GameState, action: GameAction): GameState {
  const run = state.run;
  if (action.type === "NEW_RUN")
    return {
      ...state,
      run: createRun(action.mode, action.includeLegends, action.seed),
    };
  if (run.result) return state;
  if (action.type === "SET_LINEUP") {
    if (run.mode !== "free" || !validRoster(action.roster, run.includeLegends))
      return state;
    return { ...state, run: { ...run, roster: { ...action.roster } } };
  }
  if (action.type === "SIMULATE") {
    if (!teamRatings(run.roster).complete) return state;
    const result = simulateSeason(run),
      previous = state.records[run.mode];
    return {
      ...state,
      run: { ...run, result },
      records: {
        ...state.records,
        [run.mode]: {
          runs: previous.runs + 1,
          bestWins: Math.max(previous.bestWins, result.wins),
          perfectSeasons: previous.perfectSeasons + Number(result.wins === 82),
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
