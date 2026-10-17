import type { DevelopmentRatings } from "./developmentTypes";
import type { Position } from "./types";
import type { TradeFactor } from "./tradeTypes";

export const MAX_FREE_AGENT_SIGNINGS = 100000;
/** CPU rules v1: signings per CPU club per offseason (second needs a clear gain). */
export const CPU_FREE_AGENT_SIGNINGS = 2;
/** CPU rules v1: signings the user may make per offseason, after the CPU pass. */
export const USER_FREE_AGENT_SIGNINGS = 2;
export interface FreeAgentSigning {
  year: number;
  teamId: number;
  pokemonId: number;
  releasedId: number;
  tradeIndex: number;
  source: "user" | "cpu";
  reason: string;
}
export interface FreeAgency {
  modelVersion: 1;
  transactions: FreeAgentSigning[];
  cpuYears: number[];
}
export interface FreeAgent {
  pokemonId: number;
  position: Position;
  rating: number;
  development: DevelopmentRatings;
  previousTeamId: number;
  releasedYear: number;
  releaseSource: "draft" | "signing";
}
export interface FreeAgentEvaluation {
  eligible: boolean;
  reason: string;
  teamBefore: number;
  teamAfter: number;
  fitChange: number;
  score: number;
  /** Present for shared evaluation; before/after and score are contextual value. */
  factors?: TradeFactor[];
}
