export type ScreenCoverage = "drop" | "switch" | "hedge" | "trap" | "under";
export interface CourtPoint {
  x: number;
  y: number;
}
export interface CourtAction {
  kind:
    | "advance"
    | "screen"
    | "drive"
    | "pass"
    | "kickout"
    | "reset"
    | "shoot"
    | "turnover"
    | "violation"
    | "foul";
  playerId: string;
  targetId?: string;
  clock: number;
}
export interface CourtSequence {
  possession: number;
  offenseTeamId: number;
  defenseTeamId: number;
  period: number;
  elapsedSeconds: number;
  /** Effective attack clock, capped by time remaining in the period. */
  initialClock: number;
  shotClock: number;
  seconds: number;
  coverage?: ScreenCoverage;
  coverageReason?: string;
  actions: CourtAction[];
  positions: (CourtPoint & { playerId: string; offense: boolean })[];
  shooterId: string;
  defenderId: string;
  zone: "rim" | "mid" | "three";
  defenderDistance: number;
  paintCrowding: number;
  shotLogOdds: number;
  outcome:
    "shot" | "turnover" | "violation" | "made" | "missed" | "blocked" | "foul";
  points: number;
}

/** Court rules for newly created seasons. Version 1 stays frozen for saved replays. */
export const COURT_VERSION = 2 as const;
export type CourtVersion = 1 | 2;
export const isCourtVersion = (value: unknown): value is CourtVersion =>
  value === 1 || value === 2;
