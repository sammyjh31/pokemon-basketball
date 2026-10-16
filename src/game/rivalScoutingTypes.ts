/** Compact completed-season observations, separate from live game scouting. */
export interface RivalThreat {
  pokemonId: number;
  attempts: number;
  points: number;
  rimAttempts: number;
  threeAttempts: number;
}
export interface RivalRecord {
  teamId: number;
  games: number;
  losses: number;
  playoffGames: number;
  threats: RivalThreat[];
}
export interface RivalScouting {
  version: 1;
  teams: Record<number, RivalRecord[]>;
}
export interface RivalHistory {
  year: number;
  rivalScouting?: RivalScouting;
}
