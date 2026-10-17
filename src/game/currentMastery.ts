import type { Run } from "./types";
/** Current previews follow completed games; historical reports use frozen fixtures. */
export function currentMasteryBanks(
  run: Pick<Run, "playoffs" | "result" | "seasonProgress">,
) {
  return (
    run.playoffs?.abilityMastery ??
    run.result?.league?.abilityMastery ??
    run.seasonProgress?.result?.league?.abilityMastery
  );
}
