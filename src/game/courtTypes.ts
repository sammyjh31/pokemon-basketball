export type ScreenCoverage = 'drop' | 'switch' | 'hedge' | 'trap' | 'under';
export interface CourtPoint { x: number; y: number }
export interface CourtAction {
  kind: 'advance' | 'screen' | 'drive' | 'pass' | 'kickout' | 'reset' | 'shoot' | 'turnover' | 'violation';
  playerId: string;
  targetId?: string;
  clock: number;
}
export interface CourtSequence {
  possession: number;
  offenseTeamId: number;
  defenseTeamId: number;
  period: number;
  elapsedSeconds: number;
  initialClock: number;
  shotClock: number;
  seconds: number;
  coverage?: ScreenCoverage;
  coverageReason?: string;
  actions: CourtAction[];
  positions: (CourtPoint & { playerId: string; offense: boolean })[];
  shooterId: string;
  defenderId: string;
  zone: 'rim' | 'mid' | 'three';
  defenderDistance: number;
  paintCrowding: number;
  shotLogOdds: number;
  outcome: 'shot' | 'turnover' | 'violation' | 'made' | 'missed' | 'blocked' | 'foul';
  points: number;
}
