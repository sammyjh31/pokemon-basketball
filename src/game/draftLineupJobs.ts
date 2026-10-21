import { createLineupDraftProjector } from "./draftLineup";
import type { DraftImpactFocus, DraftImpactProjection } from "./draftImpact";
import type { Roster, RosterSlot, RotationStyle, Tactic } from "./types";

export interface DraftLineupJob {
  ids: number[];
  roster: Roster;
  tactic: Tactic;
  rotation: RotationStyle;
  focus: DraftImpactFocus;
  lockedSlots?: readonly RosterSlot[];
  shinySeed?: number;
}

/** Identical pure projection work for worker and inline callers. */
export function runDraftLineupJob(
  job: DraftLineupJob,
  onProgress?: (done: number) => void,
): DraftImpactProjection[] {
  const project = createLineupDraftProjector(
    job.roster,
    job.tactic,
    job.rotation,
    job.focus,
    job.lockedSlots,
    job.shinySeed,
  );
  const projections: DraftImpactProjection[] = [];
  for (const [i, id] of job.ids.entries()) {
    const projection = project(id);
    if (projection) projections.push(projection);
    if ((i + 1) % 40 === 0) onProgress?.(i + 1);
  }
  return projections;
}
