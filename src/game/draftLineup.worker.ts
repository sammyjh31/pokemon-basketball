import { createLineupDraftProjector } from "./draftLineup";
import type { DraftImpactFocus } from "./draftImpact";
import type { Roster, RosterSlot, RotationStyle, Tactic } from "./types";

export interface DraftLineupJob {
  ids: number[];
  roster: Roster;
  tactic: Tactic;
  rotation: RotationStyle;
  focus: DraftImpactFocus;
  lockedSlots?: readonly RosterSlot[];
}
self.onmessage = ({ data }: MessageEvent<DraftLineupJob>) => {
  const project = createLineupDraftProjector(
    data.roster,
    data.tactic,
    data.rotation,
    data.focus,
    data.lockedSlots,
  );
  const projections = [];
  for (const [i, id] of data.ids.entries()) {
    const projection = project(id);
    if (projection) projections.push(projection);
    if ((i + 1) % 40 === 0) self.postMessage({ done: i + 1 });
  }
  self.postMessage({ done: data.ids.length, projections });
};
