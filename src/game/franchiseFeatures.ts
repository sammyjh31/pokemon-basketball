import type {
  LeagueMatch,
  LeaguePlayer,
  LeagueTeam,
  Position,
  RosterSlot,
  SeasonResult,
} from "./types";
import type { Playoffs } from "./playoffTypes";
export interface RotationPlan {
  minutes: Record<RosterSlot, number>;
  closing: RosterSlot[];
}
export const TRAINING_FOCUSES = [
  "balanced",
  "shooting",
  "defense",
  "playmaking",
  "conditioning",
  "position",
] as const;
export const TRAINING_INTENSITIES = [
  "steady",
  "standard",
  "aggressive",
] as const;
export interface PlayerTrainingPlan {
  focus: (typeof TRAINING_FOCUSES)[number];
  intensity: (typeof TRAINING_INTENSITIES)[number];
  position?: Position;
}
export type TrainingPlans = Partial<Record<number, PlayerTrainingPlan>>;
export interface OfficialGame {
  fixtureId: string;
  match: LeagueMatch;
  courtScore: [number, number];
  scale: 12;
}
export interface SeasonProgress {
  modelVersion: 1;
  completedRounds: number;
  playedGames: Record<string, OfficialGame>;
  result?: SeasonResult;
}
export interface SeasonReplayArchive {
  modelVersion: 1;
  seasonModel: 3 | 4 | 5 | 6;
  teams: LeagueTeam[];
  regularPlayers: LeaguePlayer[];
  playoffPlayers: LeaguePlayer[];
  playedGames: Record<string, OfficialGame>;
  playoffs: Playoffs;
}
