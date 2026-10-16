import type { Attributes, Position, Roster } from "../types";
import type { PlayerDevelopment } from "../developmentTypes";
export type Side = 0 | 1;
export type Phase = "tipoff" | "live" | "inbound" | "break" | "final";
export type PlayerAction =
  "idle" | "run" | "shoot" | "pass" | "dunk" | "block" | "steal" | "screen";
export interface ArcadeSetup {
  teams: [
    { name: string; roster: Roster; development?: PlayerDevelopment },
    { name: string; roster: Roster; development?: PlayerDevelopment },
  ];
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
  action: PlayerAction;
  actionTime: number;
  cooldown: number;
  jumpTime: number;
  charge: number | null;
  stats: ArcadeStats;
}
export interface Ball {
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
