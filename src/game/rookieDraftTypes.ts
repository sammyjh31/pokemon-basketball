export interface RookiePick {
  pick: number;
  round: 1 | 2;
  teamId: number;
  pokemonId: number;
  releasedId: number;
}
export interface RookieDraft {
  modelVersion: 1;
  year: number;
  generation: number;
  order: number[];
  picks: RookiePick[];
  complete: boolean;
  tradeIndex: number;
  exhausted?: boolean;
}
