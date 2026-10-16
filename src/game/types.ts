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
  leagueGameId?: string;
  opponentBoxScore?: LeagueBox[];
  playerOfGameTeamId?: number;
}
export interface SeasonResult {
  games: GameResult[];
  wins: number;
  losses: number;
  mvpId: number;
  modelVersion?: 1 | 2 | 3;
  league?: LeagueResult;
  mvpTeamId?: number;
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
  defense?: DefenseScheme;
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
  version: 3;
  run: Run;
  records: Records;
}

export const DEFENSE_SCHEMES = ["man", "switch", "zone", "press"] as const;
export type DefenseScheme = (typeof DEFENSE_SCHEMES)[number];
export const DEFENSE_LABELS: Record<DefenseScheme, string> = {
  man: "Man to man",
  switch: "Switch everything",
  zone: "Protect the paint",
  press: "Full-court pressure",
};
export type PlayType =
  "transition" | "pickRoll" | "isolation" | "post" | "spotUp";
export interface LeagueTeam {
  id: number;
  name: string;
  roster: Roster;
  tactic: Tactic;
  rotation: RotationStyle;
  defense: DefenseScheme;
  ratings: TeamRatings;
}
export interface LeagueFixture {
  id: string;
  round: number;
  homeTeamId: number;
  awayTeamId: number;
  seed: number;
}
export interface LeagueBox extends PlayerBox {
  teamId: number;
  playerId: string;
  started: boolean;
  fouls: number;
  plusMinus: number;
  rimFgm: number;
  rimFga: number;
  midFgm: number;
  midFga: number;
}
export interface LeagueGameSummary extends LeagueFixture {
  homeScore: number;
  awayScore: number;
  overtimePeriods: number;
}
export interface LeagueMatch {
  homeScore: number;
  awayScore: number;
  homeBox: LeagueBox[];
  awayBox: LeagueBox[];
  overtimePeriods: number;
  possessions: number;
  periods: { home: number; away: number }[];
  leadChanges: number;
  largestLead: { home: number; away: number };
  plays: Record<PlayType, { home: number; away: number }>;
  playerOfGameId: string;
}
export interface LeaguePlayer extends SeasonPlayer {
  teamId: number;
  teamName: string;
  playerId: string;
  fouls: number;
  plusMinus: number;
  rimFgm: number;
  rimFga: number;
  midFgm: number;
  midFga: number;
}
export interface Standing {
  teamId: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  homeWins: number;
  awayWins: number;
  streak: number;
  lastTen: number;
}
export interface LeagueAward extends SeasonAward {
  playerId: string;
  teamId: number;
  score: number;
  finalists: {
    playerId: string;
    teamId: number;
    pokemonId: number;
    score: number;
    value: string;
  }[];
}
export interface LeagueResult {
  teams: LeagueTeam[];
  games: LeagueGameSummary[];
  players: LeaguePlayer[];
  standings: Standing[];
  awards: LeagueAward[];
  allLeague: string[];
  allDefense: string[];
}
