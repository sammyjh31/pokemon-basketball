import type { Attributes, Position, Tactic } from "../types";
import type { AbilityActivations } from "../abilities";
import type { EvaluationTeam } from "../teamEvaluation";
export type Side = 0 | 1;
export type Phase = "tipoff" | "live" | "inbound" | "break" | "final";
export type PlayerAction =
  "idle" | "run" | "shoot" | "pass" | "dunk" | "block" | "steal" | "screen";
export interface ArcadeTeam extends Omit<EvaluationTeam, "tactic"> {
  name: string;
  tactic?: Tactic;
}
export interface ArcadeSetup {
  abilityVersion?: 1;
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
  attributes: Attributes;
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
  abilityVersion?: 1;
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
