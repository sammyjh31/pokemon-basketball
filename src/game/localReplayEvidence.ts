import type { LeagueTeam } from "./types";
import type { Playoffs } from "./playoffTypes";

/** News/stat history stays in the authenticated source, not another cached copy. */
export interface LocalArchiveEvidence {
  championId: number | null;
  seeds: Playoffs["seeds"];
  finalTeams: LeagueTeam[];
}
export interface LocalReplayContext {
  verified: ReadonlyMap<number, LocalArchiveEvidence>;
  captured: Map<number, LocalArchiveEvidence>;
  used: Set<number>;
  signal?: AbortSignal;
}
