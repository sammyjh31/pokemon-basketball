export interface RookiePick {
  pick: number;
  round: 1 | 2;
  teamId: number;
  pokemonId: number;
  releasedId: number;
}
/**
 * Model 1: worst record first, ties by team id, every turn must pick.
 * Model 2 (CPU rules v1): weighted lottery for non-playoff clubs, seeded
 * tiebreaks, and clubs may pass a turn (recorded by pick number in `passes`).
 */
export interface RookieDraft {
  modelVersion: 1 | 2;
  year: number;
  generation: number;
  order: number[];
  picks: RookiePick[];
  complete: boolean;
  tradeIndex: number;
  exhausted?: boolean;
  passes?: number[];
}
