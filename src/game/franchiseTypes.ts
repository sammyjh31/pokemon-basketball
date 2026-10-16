import type { TrainingPlans, SeasonReplayArchive } from "./franchiseFeatures";
import type { LeaguePlayer, LeagueTeam, Standing, SeasonAward } from "./types";
import type { FinalsMvp } from "./playoffTypes";
import type { OffseasonReport } from "./developmentTypes";

export const FRANCHISE_MAX_YEARS = 1000;
export const FRANCHISE_MAX_TRADES = 10000;

export const CAREER_KEYS = [
  "minutes",
  "points",
  "offensiveRebounds",
  "defensiveRebounds",
  "assists",
  "steals",
  "blocks",
  "turnovers",
  "fgm",
  "fga",
  "threePM",
  "threePA",
  "ftm",
  "fta",
  "fouls",
  "plusMinus",
  "rimFgm",
  "rimFga",
  "midFgm",
  "midFga",
  "gamesPlayed",
  "gamesStarted",
  "doubleDoubles",
  "tripleDoubles",
  "highPoints",
  "playerOfGame",
] as const;
export type CareerTotals = Pick<LeaguePlayer, (typeof CAREER_KEYS)[number]>;
export interface CareerPlayer {
  pokemonId: number;
  seasons: number;
  teamIds: number[];
  regular: CareerTotals;
  playoffs: CareerTotals;
}
export interface HistoricalHonor {
  pokemonId: number;
  teamId: number;
}
export interface FranchiseSeason {
  year: number;
  seasonSeed: number;
  standings: Standing[];
  rosters: number[][];
  awards: (SeasonAward & { teamId: number })[];
  allLeague: HistoricalHonor[];
  allDefense: HistoricalHonor[];
  championId: number;
  runnerUpId: number;
  runnerUpWins: number;
  finalsMvp: FinalsMvp;
  replay?: SeasonReplayArchive;
}
export interface FranchiseTrade {
  year: number;
  teamId: number;
  giveId: number;
  receiveId: number;
  fromTeamId?: number;
  source?: "cpu";
  reason?: string;
}
export interface Franchise {
  modelVersion: 1 | 2 | 3;
  year: number;
  phase: "season" | "offseason";
  teams: LeagueTeam[];
  careers: CareerPlayer[];
  history: FranchiseSeason[];
  trades: FranchiseTrade[];
  offseasons?: OffseasonReport[];
  trainingPlans?: TrainingPlans;
}
export interface TradeEvaluation {
  accepted: boolean;
  reason: string;
  outgoingValue: number;
  incomingValue: number;
  partnerBefore: number;
  partnerAfter: number;
}
