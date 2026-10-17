import type { Run } from "./types";

/** Current previews follow completed games; fixture reports use frozen snapshots. */
export function currentMoraleBanks(
  run: Pick<Run, "playoffs" | "result" | "seasonProgress">,
) {
  return (
    run.playoffs?.morale ??
    run.result?.league?.morale ??
    run.seasonProgress?.result?.league?.morale
  );
}
