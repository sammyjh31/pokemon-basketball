import type { LeagueGameSummary, LeaguePlayer } from "./types";
import type { OfficialGame } from "./franchiseFeatures";

export type PlayoffMode = "game" | "round" | "all";
export type PlayoffRound = 0 | 1 | 2 | 3;
export interface PlayoffSeed {
  seed: number;
  teamId: number;
  wins: number;
  losses: number;
}
export interface PlayoffSeries {
  id: string;
  round: PlayoffRound;
  index: number;
  higherSeedId: number | null;
  lowerSeedId: number | null;
  higherSeedWins: number;
  lowerSeedWins: number;
  winnerId: number | null;
  games: LeagueGameSummary[];
}
export interface FinalsMvp {
  playerId: string;
  pokemonId: number;
  teamId: number;
  score: number;
  value: string;
}
export interface Playoffs {
  modelVersion: 1 | 2;
  playedGames?: Record<string, OfficialGame>;
  seeds: PlayoffSeed[];
  series: PlayoffSeries[];
  players: LeaguePlayer[];
  finalsPlayers: LeaguePlayer[];
  championId: number | null;
  finalsMvp: FinalsMvp | null;
}
