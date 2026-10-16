export interface ScoutedPlayer {
  attempts: number;
  points: number;
  rimAttempts: number;
  threeAttempts: number;
}

/** Observations of one opponent, discounted between meetings; never a win bonus. */
export interface OpponentScouting {
  games: number;
  possessions: number;
  pickRolls: number;
  switches: number;
  helpRotations: number;
  players: Record<number, ScoutedPlayer>;
}

/** Keys are observerTeamId:opponentTeamId. Rebuilt from completed games. */
export type ScoutingMemory = Record<string, OpponentScouting>;
export interface MatchScouting {
  home: OpponentScouting;
  away: OpponentScouting;
}

export interface TypeTacticsSummary {
  priorMeetings: number;
  priorityThreatId?: number;
  crossMatches: number;
  screens: number;
  switches: number;
  stays: number;
  rolls: number;
  helpRotations: number;
  kickouts: number;
  notes: string[];
}

export interface TypeTacticsReport {
  home: TypeTacticsSummary;
  away: TypeTacticsSummary;
}
