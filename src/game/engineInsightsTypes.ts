import type { PossessionInsights } from "./possessionTypes";
import type { PlayType } from "./types";

export interface EngineRules {
  version: 1;
  abilities: boolean;
  adaptiveCoaching: boolean;
  /** Continuity from 0 (new group) to 1 (established teammates). */
  familiarity: number;
}
export interface ShotEvent {
  creatorId?: string;
  putback?: boolean;
  kickout?: boolean;
  secondChance?: boolean;
  transition?: boolean;
  index: number;
  period: number;
  elapsedSeconds: number;
  offenseTeamId: number;
  defenseTeamId: number;
  shooterId: string;
  defenderId: string;
  blockerId?: string;
  zone: "rim" | "mid" | "three";
  play: PlayType;
  value: 2 | 3;
  /** Before resolution: includes block risk, or and-one probability on a foul. */
  expectedProbability: number;
  made: boolean;
  blocked: boolean;
  foul: boolean;
  /** A missed shooting-foul attempt is not an official field-goal attempt. */
  countsAsAttempt: boolean;
  contested: boolean;
  /** Schematic display coordinates, 0..100, not simulated court tracking. */
  x: number;
  y: number;
}
export interface LineupSummary {
  teamId: number;
  /** Five unique team:species IDs, sorted for grouping, not position ordering. */
  playerIds: string[];
  seconds: number;
  /** Offensive possessions started by this five-player group. */
  possessions: number;
  pointsFor: number;
  pointsAgainst: number;
}
export interface DefenseSummary {
  teamId: number;
  playerId: string;
  /** Assigned shot events, including shooting fouls. */
  matchups: number;
  /** Official field-goal attempts faced. */
  attempts: number;
  contests: number;
  /** Field-goal points only; free throws are excluded. */
  pointsAllowed: number;
  /** Expected field-goal points over all assigned events, including fouls. */
  expectedPointsAllowed: number;
  blocks: number;
  steals: number;
  /** Actual disrupted-pass events; includes stolen deflections. */
  deflections: number;
  shootingFouls: number;
}
export interface CoachingAdjustment {
  teamId: number;
  period: number;
  elapsedSeconds: number;
  kind: "tactic" | "defense";
  from: string;
  to: string;
  reason: string;
  evidence: string;
}
export interface MatchInsights {
  possession?: PossessionInsights;
  version: 1;
  coordinateSystem: "schematic-half-court";
  shots: ShotEvent[];
  lineups: LineupSummary[];
  defense: DefenseSummary[];
  adjustments: CoachingAdjustment[];
}
