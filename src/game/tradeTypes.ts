import type { Position } from "./types";
import type { TradeEvaluation } from "./franchiseTypes";
export interface TradePackage {
  teamId: number;
  giveIds: number[];
  receiveIds: number[];
}
export type TradeAvailability = "available" | "listening" | "core";
export interface ClubTradeProfile {
  teamId: number;
  direction: "contend" | "retool" | "develop";
  title: string;
  priorities: string[];
  reason: string;
}
export interface TradeMarketPlayer {
  pokemonId: number;
  teamId: number;
  position: Position;
  rating: number;
  availability: TradeAvailability;
  reason: string;
  role: string;
  trend: number;
}
export interface TradeFactor {
  label: string;
  change: number;
  contribution: number;
  detail: string;
}
export interface PackageEvaluation extends TradeEvaluation {
  factors: TradeFactor[];
  profile: ClubTradeProfile;
  score: number;
  threshold: number;
  userDelta: number;
}
export interface TradeSuggestion {
  offer: TradePackage;
  evaluation: PackageEvaluation;
  rank: number;
}
export interface SuggestionOptions {
  teamId?: number;
  targetId?: number;
  giveIds?: number[];
  packageSize?: 1 | 2 | 3;
  limit?: number;
}
