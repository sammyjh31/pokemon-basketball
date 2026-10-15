export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type Position = (typeof POSITIONS)[number];
export const BENCH_SLOTS = ["B1", "B2", "B3"] as const;
export type BenchSlot = (typeof BENCH_SLOTS)[number];
export const ROSTER_SLOTS = [...POSITIONS, ...BENCH_SLOTS] as const;
export type RosterSlot = (typeof ROSTER_SLOTS)[number];
export const POSITION_NAMES: Record<Position, string> = {
  PG: "Point guard",
  SG: "Shooting guard",
  SF: "Small forward",
  PF: "Power forward",
  C: "Center",
};
export const SLOT_NAMES: Record<RosterSlot, string> = {
  ...POSITION_NAMES,
  B1: "Sixth player",
  B2: "Seventh player",
  B3: "Eighth player",
};
export type Mode = "spin" | "free";
export type Roster = Record<RosterSlot, number | null>;
export const emptyRoster = (): Roster => ({
  PG: null,
  SG: null,
  SF: null,
  PF: null,
  C: null,
  B1: null,
  B2: null,
  B3: null,
});
export const TACTICS = [
  "balanced",
  "pace",
  "perimeter",
  "interior",
  "defense",
] as const;
export type Tactic = (typeof TACTICS)[number];
export const TACTIC_LABELS: Record<Tactic, string> = {
  balanced: "Balanced",
  pace: "Run & gun",
  perimeter: "Space & shoot",
  interior: "Inside out",
  defense: "Defense first",
};
export const ROTATIONS = ["balanced", "starters", "bench"] as const;
export type RotationStyle = (typeof ROTATIONS)[number];
export interface Pokemon {
  id: number;
  name: string;
  types: string[];
  stats: {
    hp: number;
    attack: number;
    defense: number;
    specialAttack: number;
    specialDefense: number;
    speed: number;
  };
  heightM: number;
  weightKg: number;
  legendary: boolean;
  spriteUrl: string;
}
export interface Attributes {
  shooting: number;
  playmaking: number;
  finishing: number;
  perimeterDefense: number;
  interiorDefense: number;
  rebounding: number;
  threePoint: number;
  midRange: number;
  freeThrow: number;
  ballHandling: number;
  passing: number;
  speed: number;
  strength: number;
  stamina: number;
  vertical: number;
  steal: number;
  block: number;
  offensiveRebound: number;
  defensiveRebound: number;
  composure: number;
}
export interface TeamRatings {
  offense: number;
  defense: number;
  overall: number;
  filled: number;
  complete: boolean;
  rosterFilled?: number;
  spacing?: number;
  creation?: number;
  rimProtection?: number;
  bench?: number;
  chemistry?: number;
}
export interface Opponent {
  id: number;
  name: string;
  offense: number;
  defense: number;
  pace: number;
  style: string;
}
export interface Matchup {
  index: number;
  opponentId: number;
  home: boolean;
}
export interface PlayerBox {
  pokemonId: number;
  slot: RosterSlot;
  minutes: number;
  points: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgm: number;
  fga: number;
  threePM: number;
  threePA: number;
  ftm: number;
  fta: number;
}
export interface SeasonPlayer extends PlayerBox {
  gamesPlayed: number;
  gamesStarted: number;
  doubleDoubles: number;
  tripleDoubles: number;
  highPoints: number;
  playerOfGame: number;
}
export interface SeasonAward {
  id: "mvp" | "defense" | "sixth" | "scoring" | "playmaking" | "rebounding";
  title: string;
  pokemonId: number;
  description: string;
  value: string;
}
export interface GameResult extends Matchup {
  winProbability: number;
  teamScore: number;
  opponentScore: number;
  won: boolean;
  overtime: boolean;
  playerOfGameId: number;
  boxScore?: PlayerBox[];
  overtimePeriods?: number;
  possessions?: number;
}
export interface SeasonResult {
  games: GameResult[];
  wins: number;
  losses: number;
  mvpId: number;
  modelVersion?: 1 | 2;
  playerStats?: SeasonPlayer[];
  awards?: SeasonAward[];
}
export interface Run {
  id: string;
  mode: Mode;
  includeLegends: boolean;
  roster: Roster;
  offerIds: number[];
  rerollsLeft: number;
  draftSeed: number;
  seasonSeed: number;
  tactic: Tactic;
  rotation: RotationStyle;
  result: SeasonResult | null;
}
export interface ModeRecords {
  runs: number;
  bestWins: number;
  perfectSeasons: number;
}
export interface Records {
  spin: ModeRecords;
  free: ModeRecords;
}
export interface GameState {
  version: 2;
  run: Run;
  records: Records;
}
