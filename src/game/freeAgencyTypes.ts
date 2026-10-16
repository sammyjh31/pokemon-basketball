import type { DevelopmentRatings } from "./developmentTypes";
import type { Position } from "./types";

export const MAX_FREE_AGENT_SIGNINGS = 100000;
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
}
