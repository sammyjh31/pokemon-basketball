import {
  advanceRookieDraft,
  beginRookieDraft,
  passRookiePick,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import type { GameState } from "./types";
import type { Franchise } from "./franchiseTypes";
export type RookieDraftAction =
  | { type: "BEGIN_ROOKIE_DRAFT" }
  | { type: "ADVANCE_ROOKIE_DRAFT" }
  | { type: "PASS_ROOKIE_PICK" }
  | { type: "PICK_ROOKIE"; pokemonId: number; releasedId: number };
export type RookieDraftJob =
  | { kind: "solo-action"; state: GameState; action: RookieDraftAction }
  | { kind: "recommendation"; franchise: Franchise; includeLegends: boolean };
export type RookieDraftResult<J extends RookieDraftJob> = J extends {
  kind: "solo-action";
}
  ? GameState
  : ReturnType<typeof recommendedRookiePick>;
export type RookieDraftProgress = (completed: number, total: number) => void;

/** Use the same transaction rules as saved franchises, including historical CPU decisions. */
export function calculateRookieDraftJob<J extends RookieDraftJob>(
  job: J,
  progress?: RookieDraftProgress,
): RookieDraftResult<J> {
  if (job.kind === "recommendation")
    return recommendedRookiePick(
      job.franchise,
      0,
      job.includeLegends,
    ) as RookieDraftResult<J>;
  const { state, action } = job;
  const next =
    action.type === "BEGIN_ROOKIE_DRAFT"
      ? beginRookieDraft(state, progress)
      : action.type === "ADVANCE_ROOKIE_DRAFT"
        ? advanceRookieDraft(state, progress)
        : action.type === "PASS_ROOKIE_PICK"
          ? passRookiePick(state, progress)
          : selectRookie(state, action.pokemonId, action.releasedId, progress);
  return next as RookieDraftResult<J>;
}
