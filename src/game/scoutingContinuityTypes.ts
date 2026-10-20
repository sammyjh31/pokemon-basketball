import type { OpponentScouting } from "./typeTacticsTypes";
export interface ScoutingTeam {
  id: number;
  roster: number[];
  coachId?: string;
}
export interface CoachBook {
  version: 1;
  year: number;
  teams: ScoutingTeam[];
  coaches: Record<
    string,
    {
      teamId: number;
      selfPlayers?: Record<number, import("./typeTacticsTypes").ScoutedPlayer>;
      opponents: Record<number, OpponentScouting>;
    }
  >;
}
export interface ScoutingHistory {
  year: number;
  coachBook?: CoachBook;
}
export interface SeedOpponent {
  roster: number[];
  opponentName: string;
  opponentCoachId?: string;
  scouting: OpponentScouting;
  sourceCoachId: string;
  sourceYear: number;
  retainedPlayers: number;
  coachChanged: boolean;
}
export interface CoachScoutingSeed {
  version: 1;
  year: number;
  coachId: string;
  opponents: Record<number, SeedOpponent>;
}
