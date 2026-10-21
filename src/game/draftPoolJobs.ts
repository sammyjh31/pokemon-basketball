import { recommendRosterPicks, type DraftRecommendation } from "./draftAdvice";
import type { EvaluationTeam } from "./teamEvaluation";
import {
  projectDraftPool,
  type DraftImpactPosition,
  type DraftImpactProjection,
} from "./draftImpact";
import type { Pokemon, Roster, RotationStyle, Tactic } from "./types";

/** Pure local-draft scouting work that can run off the main thread. */
export type DraftPoolJob =
  | {
      kind: "advice";
      pool: Pokemon[];
      roster: Roster;
      tactic: Tactic;
      /** Coaching and rule versions for contextual team value. */
      team?: EvaluationTeam;
      shinySeed?: number;
    }
  | {
      kind: "fixed";
      ids: number[];
      roster: Roster;
      position: Exclude<DraftImpactPosition, "best-lineup">;
      tactic: Tactic;
      rotation: RotationStyle;
      shinySeed?: number;
    };
export type DraftPoolResult<J extends DraftPoolJob> = J extends {
  kind: "advice";
}
  ? DraftRecommendation[]
  : DraftImpactProjection[];

export function runDraftPoolJob<J extends DraftPoolJob>(
  job: J,
): DraftPoolResult<J> {
  return (
    job.kind === "advice"
      ? recommendRosterPicks(
          job.pool,
          job.roster,
          job.tactic,
          job.pool.length,
          job.team,
          job.shinySeed,
        )
      : projectDraftPool(
          job.ids,
          job.roster,
          job.position,
          job.tactic,
          job.rotation,
          job.shinySeed,
        )
  ) as DraftPoolResult<J>;
}
