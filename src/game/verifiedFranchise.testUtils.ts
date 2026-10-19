import { performanceRun } from "./seasonPerformance.testUtils";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import type { Run } from "./types";

/** Real older completed season, including archived playoffs and offseason changes. */
export function verifiedFranchiseFixture() {
  // A real older season, followed by modern season-boundary adoption below.
  const current = performanceRun();
  const run: Run = {
    id: current.id,
    mode: current.mode,
    includeLegends: true,
    roster: current.roster,
    tactic: current.tactic,
    rotation: current.rotation,
    defense: current.defense,
    offerIds: [],
    rerollsLeft: 2,
    draftSeed: current.draftSeed,
    seasonSeed: current.seasonSeed,
    coach: current.coach,
    result: null,
  };
  const initial = { ...initialState(822), run };
  const result = simulateSeason(run);
  const applied = gameReducer(initial, {
    type: "APPLY_SEASON",
    source: run,
    result,
  });
  return processOffseason(
    archiveFranchiseSeason({
      ...applied,
      run: {
        ...applied.run,
        playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
      },
    }),
  );
}
