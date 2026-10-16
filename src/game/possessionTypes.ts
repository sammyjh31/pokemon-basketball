export interface PossessionPlayer {
  teamId: number;
  playerId: string;
  games: number;
  potentialAssists: number;
  assists: number;
  assistPoints: number;
  expectedAssistPoints: number;
  screenAssists: number;
  reboundChances: number;
  boxOuts: number;
  offensiveRebounds: number;
  defensiveRebounds: number;
}
export interface PossessionTeam {
  teamId: number;
  games: number;
  possessions: number;
  points: number;
  transitionPossessions: number;
  transitionPoints: number;
  secondChancePoints: number;
  pointsOffTurnovers: number;
  clutchPossessions: number;
  clutchPoints: number;
  paintPoints: number;
}
export interface PossessionInsights {
  version: 1;
  teams: PossessionTeam[];
  players: PossessionPlayer[];
}
export const emptyPossessionPlayer = (
  teamId: number,
  playerId: string,
): PossessionPlayer => ({
  teamId,
  playerId,
  games: 1,
  potentialAssists: 0,
  assists: 0,
  assistPoints: 0,
  expectedAssistPoints: 0,
  screenAssists: 0,
  reboundChances: 0,
  boxOuts: 0,
  offensiveRebounds: 0,
  defensiveRebounds: 0,
});
export const emptyPossessionTeam = (teamId: number): PossessionTeam => ({
  teamId,
  games: 1,
  possessions: 0,
  points: 0,
  transitionPossessions: 0,
  transitionPoints: 0,
  secondChancePoints: 0,
  pointsOffTurnovers: 0,
  clutchPossessions: 0,
  clutchPoints: 0,
  paintPoints: 0,
});
