import type {
  MoraleRoster,
  MoraleBanks,
  MoraleFixture,
  MoraleGameReport,
} from "./playerMorale";
import type { PairBonds, ChemistryFixture } from "./teammateChemistry";
import type { GameFlowFixture, GameFlowReport } from "./gameFlow";
import type { AbilityActivations } from "./abilities";
import type { CoachAssignment } from "./trainerCoaches";
import type {
  MatchScouting,
  ScoutingMemory,
  TypeTacticsReport,
} from "./typeTacticsTypes";
import type { EngineRules, MatchInsights } from "./engineInsightsTypes";
import type { RotationPlan, SeasonProgress } from "./franchiseFeatures";
import type { Playoffs } from "./playoffTypes";
import type { Franchise } from "./franchiseTypes";
import type { PlayerDevelopment } from "./developmentTypes";

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
  /** Cosmetic identity; attribute bonuses are computed, never saved as development. */
  shiny?: true;
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
  abilityActivations?: AbilityActivations;
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
  modelVersion?: 1 | 2 | 3 | 4 | 5 | 6;
  league?: LeagueResult;
  mvpTeamId?: number;
  playerStats?: SeasonPlayer[];
  awards?: SeasonAward[];
}
export interface Run {
  /** Stable league-wide species identity; omitted for historical replay. */
  shinySeed?: number;
  coach?: CoachAssignment;
  coachDraftRequired?: true;
  simulationVersion?: 2;
  /** Omitted on historical seasons to preserve their deterministic replay. */
  typeMatchupsVersion?: 1;
  typeTacticsVersion?: 1;
  /** Omitted on historical inputs for exact replay. */
  possessionVersion?: 1;
  /** Physical/type possession contests. Absent on historical seeds. */
  matchupVersion?: 1;
  /** Court geometry, action sequences and screen coverage rules. */
  courtVersion?: import("./courtTypes").CourtVersion;
  /** Species abilities. Absent on historical seasons for exact replay. */
  abilityVersion?: 1;
  abilityMasteryVersion?: 1;
  /** Coach-managed moves and mastery paths; absent on historical inputs. */
  movesetVersion?: import("./moveTypes").MovesetVersion;
  /** Physical species abilities; absent on historical seasons for exact replay. */
  physicalAbilityVersion?: 1;
  /** Active-five basketball chemistry; independent of the ability switch. */
  chemistryVersion?: 1;
  /** Earned shared court minutes; absent on historical seasons. */
  chemistryGrowthVersion?: 1;
  /** Persistent player morale; requires earned teammate chemistry. */
  moraleVersion?: 1;
  /** Stable species personalities and automatic captains; requires player morale. */
  personalityVersion?: 1;
  /** Shared team evaluation; absent on historical seasons for exact replay. */
  evaluationVersion?: 1;
  /** Playoffs, timeouts, referees, home gyms and rest; requires court rules. */
  gameFlowVersion?: 1;
  id: string;
  mode: Mode;
  /** Optional opening-draft selection; omitted on original Gen I–II runs. */
  draftPool?: import("./draftPool").DraftPool;
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
  playoffs?: Playoffs;
  /** Fixed league membership for franchise seasons (model 4). */
  leagueTeams?: LeagueTeam[];
  rotationPlan?: RotationPlan;
  seasonProgress?: SeasonProgress;
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
  franchise?: Franchise;
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
  /** Stable league-wide species identity; omitted for historical replay. */
  shinySeed?: number;
  scoutingSeed?: import("./scoutingContinuityTypes").CoachScoutingSeed;
  chemistryBonds?: PairBonds;
  morale?: MoraleRoster;
  abilityMastery?: import("./abilityMastery").MasteryRoster;
  coach?: CoachAssignment;
  engineRules?: EngineRules;
  simulationVersion?: 2;
  /** Omitted on historical seasons to preserve their deterministic replay. */
  typeMatchupsVersion?: 1;
  typeTacticsVersion?: 1;
  /** Omitted on historical inputs for exact replay. */
  possessionVersion?: 1;
  /** Physical/type possession contests. Absent on historical seeds. */
  matchupVersion?: 1;
  /** Court geometry, action sequences and screen coverage rules. */
  courtVersion?: import("./courtTypes").CourtVersion;
  /** Species abilities. Absent on historical seasons for exact replay. */
  abilityVersion?: 1;
  abilityMasteryVersion?: 1;
  /** Coach-managed moves and mastery paths; absent on historical inputs. */
  movesetVersion?: import("./moveTypes").MovesetVersion;
  /** Physical species abilities; absent on historical seasons for exact replay. */
  physicalAbilityVersion?: 1;
  /** Active-five basketball chemistry; independent of the ability switch. */
  chemistryVersion?: 1;
  /** Earned shared court minutes; absent on historical seasons. */
  chemistryGrowthVersion?: 1;
  /** Persistent player morale; requires earned teammate chemistry. */
  moraleVersion?: 1;
  /** Stable species personalities and automatic captains; requires player morale. */
  personalityVersion?: 1;
  /** Shared team evaluation; absent on historical seasons for exact replay. */
  evaluationVersion?: 1;
  /** Playoffs, timeouts, referees, home gyms and rest; requires court rules. */
  gameFlowVersion?: 1;
  id: number;
  name: string;
  roster: Roster;
  tactic: Tactic;
  rotation: RotationStyle;
  defense: DefenseScheme;
  ratings: TeamRatings;
  /** Frozen cumulative skill changes for this club's eight players. */
  development?: PlayerDevelopment;
  rotationPlan?: RotationPlan;
}
export interface LeagueFixture {
  chemistry?: ChemistryFixture;
  morale?: MoraleFixture;
  mastery?: import("./abilityMastery").MasteryFixture;
  flow?: GameFlowFixture;
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
  masteryMilestones?: import("./abilityMastery").MasteryMilestone[];
  scouting?: MatchScouting;
  homeScore: number;
  awayScore: number;
  overtimePeriods: number;
}
export interface LeagueMatch {
  counterResults?: {
    home?: import("./counterLearning").CounterResults;
    away?: import("./counterLearning").CounterResults;
  };
  counterPlans?: {
    home: import("./counterTypes").CounterPlan[];
    away: import("./counterTypes").CounterPlan[];
  };
  moveObservations?: {
    home?: import("./counterTypes").MoveReads;
    away?: import("./counterTypes").MoveReads;
  };
  comboAssignments?: Record<number, import("./comboTypes").ComboAssignment[]>;
  moveAssignments?: Record<string, import("./moveTypes").MoveAssignment>;
  moraleReport?: MoraleGameReport;
  masteryReport?: import("./abilityMastery").MasteryGameReport;
  gameFlow?: GameFlowReport;
  chemistryMinutes?: { home: PairBonds; away: PairBonds };
  typeTactics?: TypeTacticsReport;
  insights?: MatchInsights;
  typeMatchups?: Record<
    "home" | "away",
    import("./typeMatchups").TypeMatchupSummary
  >;
  shotQuality?: Record<
    "home" | "away",
    { attempts: number; expectedPoints: number; points: number }
  >;
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
  morale?: MoraleBanks;
  abilityMastery?: import("./abilityMastery").MasteryBanks;
  chemistryBonds?: Record<number, PairBonds>;
  scouting?: ScoutingMemory;
  format?: import("./localFormat").LocalFormat;
  teams: LeagueTeam[];
  games: LeagueGameSummary[];
  players: LeaguePlayer[];
  standings: Standing[];
  awards: LeagueAward[];
  allLeague: string[];
  allDefense: string[];
}
