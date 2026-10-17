import type { Attributes } from "./types";

export type DevelopmentSkill = Exclude<
  keyof Attributes,
  "shooting" | "playmaking" | "rebounding"
>;
export type DevelopmentRatings = Partial<Record<DevelopmentSkill, number>>;
export type PlayerDevelopment = Partial<Record<number, DevelopmentRatings>>;
export interface PlayerDevelopmentChange {
  training?: import("./coachTraining").CoachTrainingAssignment;
  pokemonId: number;
  teamId: number;
  before: number;
  after: number;
  minutesPerGame: number;
  impactPer36: number;
  changes: DevelopmentRatings;
  outcome: "breakout" | "growth" | "steady" | "decline" | "slump";
  reasons: string[];
}
export interface OffseasonReport {
  mastery?: import("./abilityMastery").MasteryTrainingChange[];
  modelVersion: 1;
  year: number;
  players: PlayerDevelopmentChange[];
  tradeStart: number;
  tradeCount: number;
}
export const DEVELOPMENT_SKILLS: DevelopmentSkill[] = [
  "finishing",
  "perimeterDefense",
  "interiorDefense",
  "threePoint",
  "midRange",
  "freeThrow",
  "ballHandling",
  "passing",
  "speed",
  "strength",
  "stamina",
  "vertical",
  "steal",
  "block",
  "offensiveRebound",
  "defensiveRebound",
  "composure",
];
export const DEVELOPMENT_MIN = -30;
export const DEVELOPMENT_MAX = 30;
export const DEVELOPMENT_YEAR_MIN = -10;
export const DEVELOPMENT_YEAR_MAX = 12;
export const CPU_TRADE_LIMIT = 6;
