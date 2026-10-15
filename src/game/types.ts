export const POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;
export type Position = (typeof POSITIONS)[number];
export const POSITION_NAMES: Record<Position, string> = {
  PG: "Point guard",
  SG: "Shooting guard",
  SF: "Small forward",
  PF: "Power forward",
  C: "Center",
};
export type Mode = "spin" | "free";
export type Roster = Record<Position, number | null>;
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
}
export interface TeamRatings {
  offense: number;
  defense: number;
  overall: number;
  filled: number;
  complete: boolean;
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
export interface GameResult extends Matchup {
  winProbability: number;
  teamScore: number;
  opponentScore: number;
  won: boolean;
  overtime: boolean;
  playerOfGameId: number;
}
export interface SeasonResult {
  games: GameResult[];
  wins: number;
  losses: number;
  mvpId: number;
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
  version: 1;
  run: Run;
  records: Records;
}
