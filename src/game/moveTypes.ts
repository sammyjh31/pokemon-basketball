import type { PlayerTrainingPlan } from "./franchiseFeatures";
import type { LeagueTeam } from "./types";
export const BASE_MOVE_IDS = [
  "quick-attack",
  "agility",
  "helping-hand",
  "protect",
  "iron-defense",
  "double-team",
  "focus-energy",
  "recover",
] as const;
export const SIGNATURE_MOVE_IDS = [
  "type-normal",
  "type-fire",
  "type-water",
  "type-electric",
  "type-grass",
  "type-ice",
  "type-fighting",
  "type-poison",
  "type-ground",
  "type-flying",
  "type-psychic",
  "type-bug",
  "type-rock",
  "type-ghost",
  "type-dragon",
  "type-dark",
  "type-steel",
  "type-fairy",
  "pikachu-volt-tackle",
  "charizard-skyhook",
  "blastoise-hydro-cannon",
  "venusaur-vine-screen",
  "alakazam-psychic-relay",
  "gengar-phantom-cut",
  "snorlax-body-wall",
  "dragonite-dragon-flight",
  "mewtwo-psystrike",
  "scizor-bullet-cut",
  "tyranitar-sandstorm-seal",
  "suicune-aurora-step",
  "greninja-water-shuriken",
  "lucario-aura-sphere",
] as const;
export const MOVE_IDS = [...BASE_MOVE_IDS, ...SIGNATURE_MOVE_IDS] as const;
export type MovesetVersion = 1 | 2;
export interface SignatureEffects {
  movement?: number;
  passing?: number;
  screen?: number;
  navigation?: number;
  shot?: number;
  contest?: number;
  drive?: number;
  receiverShot?: number;
}
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
  signature?: {
    kind: "type" | "species";
    type?: string;
    speciesIds?: readonly number[];
    minimumMastery: number;
  };
  effects?: SignatureEffects;
  zones?: readonly ("rim" | "mid" | "three")[];
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
  movesetVersion?: MovesetVersion;
  chemistryVersion?: 1;
  chemistryGrowthVersion?: 1;
  chemistryBonds?: import("./teammateChemistry").PairBonds;
  engineRules?: {
    abilities: boolean;
    version?: 1;
    adaptiveCoaching?: boolean;
    familiarity?: number;
  };
};
export interface MoveStats {
  combos?: import("./comboTypes").ComboStats;
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
