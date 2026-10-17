import type { Run } from "./types";

/** Current previews follow completed games; historical reports keep fixture snapshots. */
export function currentChemistryBanks(
  run: Pick<Run, "playoffs" | "result" | "seasonProgress">,
) {
  return (
    run.playoffs?.chemistryBonds ??
    run.result?.league?.chemistryBonds ??
    run.seasonProgress?.result?.league?.chemistryBonds
  );
}
