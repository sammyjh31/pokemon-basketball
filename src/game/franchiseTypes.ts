import type { RivalScouting } from "./rivalScoutingTypes";
import type { RookieDraft } from "./rookieDraftTypes";
import type { FreeAgency } from "./freeAgencyTypes";
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
export type CareerTotals = Pick<LeaguePlayer, (typeof CAREER_KEYS)[number]> &
  import("./abilities").AbilityBox;
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
  coachBook?: import("./scoutingContinuityTypes").CoachBook;
  newsGames?: import("./types").LeagueGameSummary[];
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
  rivalScouting?: RivalScouting;
}
export interface FranchiseTrade {
  packageVersion?: 1;
  giveIds?: number[];
  receiveIds?: number[];
  year: number;
  teamId: number;
  giveId: number;
  receiveId: number;
  fromTeamId?: number;
  source?: "cpu";
  reason?: string;
}
/**
 * CPU front-office rules. Absent on franchises saved before version 1; those
 * adopt it when their next offseason begins, and every earlier offseason keeps
 * the rules it was played under. `since` is the first governed offseason year.
 */
export interface CpuRules {
  modelVersion: 1;
  since: number;
}
export interface Franchise {
  /** Stable league-wide species identity; omitted for historical replay. */
  shinySeed?: number;
  /** Opening draft eligibility; omitted for original Gen I–II leagues. */
  initialDraftPool?: import("./draftPool").DraftPool;
  coachOffice?: import("./coachOffice").CoachOffice;
  pendingCoach?: import("./trainerCoaches").CoachAssignment;
  modelVersion: 1 | 2 | 3;
  cpuRules?: CpuRules;
  year: number;
  phase: "season" | "offseason";
  teams: LeagueTeam[];
  careers: CareerPlayer[];
  history: FranchiseSeason[];
  trades: FranchiseTrade[];
  offseasons?: OffseasonReport[];
  trainingPlans?: TrainingPlans;
  rookieDrafts?: RookieDraft[];
  freeAgency?: FreeAgency;
}
export interface TradeEvaluation {
  accepted: boolean;
  reason: string;
  outgoingValue: number;
  incomingValue: number;
  partnerBefore: number;
  partnerAfter: number;
}
