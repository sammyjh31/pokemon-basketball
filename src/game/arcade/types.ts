import type { MasteryFixture } from "../abilityMastery";
import type { Attributes, Position, Tactic } from "../types";
import type { AbilityActivations } from "../abilities";
import type { EvaluationTeam } from "../teamEvaluation";
import type { PlayerProfile } from "../playerProfile";
import type { ChemistryContext, LineupChemistry } from "../lineupChemistry";
import type { ChemistryFixture, PairBonds } from "../teammateChemistry";
import type { MoraleFixture } from "../playerMorale";
export type Side = 0 | 1;
export type Phase = "tipoff" | "live" | "inbound" | "break" | "final";
export type PlayerAction =
  "idle" | "run" | "shoot" | "pass" | "dunk" | "block" | "steal" | "screen";
export interface ArcadeTeam extends Omit<
  EvaluationTeam,
  "tactic" | "engineRules"
> {
  name: string;
  tactic?: Tactic;
  engineRules?: { abilities: boolean; familiarity?: number };
}
export interface ArcadeSetup {
  chemistryVersion?: 1;
  chemistryGrowthVersion?: 1;
  moraleVersion?: 1;
  personalityVersion?: 1;
  abilityVersion?: 1;
  abilityMasteryVersion?: 1;
  physicalAbilityVersion?: 1;
  evaluationVersion?: 1;
  typeMatchupsVersion?: 1;
  official?: boolean;
  teams: [ArcadeTeam, ArcadeTeam];
  seed: number;
}
export interface ArcadeInput {
  moveX: number;
  moveY: number;
  shoot: boolean;
  pass: boolean;
  switch: boolean;
  turbo: boolean;
}
export interface ArcadeStats {
  abilityActivations?: AbilityActivations;
  rimFgm?: number;
  rimFga?: number;
  midFgm?: number;
  midFga?: number;
  plusMinus?: number;
  seconds: number;
  points: number;
  fgm: number;
  fga: number;
  threePM: number;
  threePA: number;
  assists: number;
  steals: number;
  blocks: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  turnovers: number;
}
export interface ArcadePlayer {
  id: number;
  pokemonId: number;
  name: string;
  type: string;
  team: Side;
  slot: Position;
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
  facing: number;
  energy: number;
  /** Frozen pregame ability mastery; never earns XP during practice. */
  masteryXp?: number;
  /** Neutral velocity used to measure actual movement added by physical abilities. */
  physicalNeutralVelocity?: { x: number; y: number };
  attributes: Attributes;
  /** Developed profile captured for this game; ratings are never modified by chemistry. */
  chemistryProfile?: PlayerProfile;
  /** Frozen shared values for CPU substitution roles; absent in historical games. */
  roleScores?: Record<Position, number>;
  action: PlayerAction;
  actionTime: number;
  cooldown: number;
  jumpTime: number;
  charge: number | null;
  stats: ArcadeStats;
}
export interface Ball {
  officialZone?: "rim" | "mid" | "three";
  testedInterceptors?: number[];
  rimContact?: boolean;
  releaseTime?: number;
  mode: "held" | "pass" | "shot" | "loose";
  x: number;
  y: number;
  z: number;
  owner: number | null;
  from: number | null;
  target: number | null;
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  travel: number;
  duration: number;
  shotValue: 2 | 3;
  made: boolean;
  dunk: boolean;
  lob: boolean;
  reboundOf: Side | null;
  lastTouch: Side;
}
export interface ArcadeEvent {
  zone?: "rim" | "mid" | "three";
  tick?: number;
  id: number;
  kind:
    | "shot"
    | "score"
    | "pass"
    | "steal"
    | "block"
    | "rebound"
    | "turnover"
    | "period"
    | "sub";
  team: Side;
  player: number | null;
  target?: number;
  value?: number;
  time: number;
}
export interface ArcadeState {
  chemistryVersion?: 1;
  chemistryGrowthVersion?: 1;
  moraleVersion?: 1;
  personalityVersion?: 1;
  /** Frozen pregame roster state; home is arcade side 0, away is side 1. */
  moraleInitial?: MoraleFixture;
  masteryInitial?: MasteryFixture;
  /** Frozen pregame roster-pair snapshot; home is arcade side 0, away is side 1. */
  chemistryInitial?: ChemistryFixture;
  /** Raw arcade minutes, by side 0/home and side 1/away. Official conversion scales
   * by 12 before rounding; these accumulated minutes never alter this game's bonds. */
  chemistryMinutes?: { home: PairBonds; away: PairBonds };
  chemistryContexts?: [
    Omit<ChemistryContext, "abilities">,
    Omit<ChemistryContext, "abilities">,
  ];
  chemistryLineups?: [
    { key: string; lineup: LineupChemistry },
    { key: string; lineup: LineupChemistry },
  ];
  abilityVersion?: 1;
  abilityMasteryVersion?: 1;
  physicalAbilityVersion?: 1;
  /** Opposing screen contacts remain one encounter until the players separate. */
  physicalScreenContacts?: string[];
  evaluationVersion?: 1;
  abilityPossession?: { transitionAt: number | null; secondChance: boolean };
  typeMatchupsVersion?: 1;
  official?: boolean;
  officialSeed?: number;
  modelVersion: 1;
  names: [string, string];
  players: ArcadePlayer[];
  phase: Phase;
  paused: boolean;
  period: number;
  clock: number;
  shotClock: number;
  elapsed: number;
  tick: number;
  ball: Ball;
  possession: Side;
  controlled: number;
  passTarget: number | null;
  score: [number, number];
  streak: [number, number];
  fire: [number, number];
  pendingSubs: { outId: number; inId: number }[];
  events: ArcadeEvent[];
  message: string;
  messageTime: number;
  seed: number;
  phaseTime: number;
  openingTeam: Side;
  lastPass: { from: number; to: number; time: number } | null;
  pendingHorn: boolean;
  prevShoot: boolean;
  aiTimer: number;
  tipTiming: number | null;
}
export const NO_INPUT: ArcadeInput = {
  moveX: 0,
  moveY: 0,
  shoot: false,
  pass: false,
  switch: false,
  turbo: false,
};
