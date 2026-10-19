import type { PlayerTrainingPlan } from "./franchiseFeatures";
import type { LeagueTeam } from "./types";
export const MOVE_IDS = [
  "quick-attack",
  "agility",
  "helping-hand",
  "protect",
  "iron-defense",
  "double-team",
  "focus-energy",
  "recover",
] as const;
export type MoveId = (typeof MOVE_IDS)[number];
export type MoveOpportunity =
  | "drive"
  | "cut"
  | "pass"
  | "screen"
  | "navigate"
  | "defend"
  | "shoot"
  | "recover";
export type Specialization =
  "fundamentals" | "power" | "control" | "efficiency";
export interface BasketballMove {
  id: MoveId;
  name: string;
  description: string;
  focus: PlayerTrainingPlan["focus"];
  opportunities: readonly MoveOpportunity[];
  cost: number;
  cooldown: number;
}
export interface MoveAssignment {
  moves: BasketballMove[];
  specialization: Specialization;
  focus: PlayerTrainingPlan["focus"];
  xp: number;
  projectedFit: number;
  nextSlot: number | null;
  reasons: string[];
}
export type MoveTeam = Pick<
  LeagueTeam,
  | "roster"
  | "tactic"
  | "coach"
  | "development"
  | "abilityVersion"
  | "abilityMasteryVersion"
  | "abilityMastery"
  | "courtVersion"
> & {
  movesetVersion?: 1;
  engineRules?: {
    abilities: boolean;
    version?: 1;
    adaptiveCoaching?: boolean;
    familiarity?: number;
  };
};
export interface MoveStats {
  uses: Partial<Record<MoveId, number>>;
  energySpent: number;
  energyRecovered: number;
}
export interface MoveEvent {
  playerId: string;
  move: MoveId;
  specialization: Specialization;
  opportunity: MoveOpportunity;
  elapsedSeconds: number;
  energySpent: number;
  energyRecovered: number;
}
