import { nextRandom } from "./random";
import type { Standing } from "./types";

/** Clubs outside the 16-team postseason field enter the lottery. */
export const LOTTERY_TEAMS = 14;
/** Picks decided by lottery draws; the rest follow reverse record order. */
export const LOTTERY_DRAWS = 4;
/** Relative odds, worst record first (14% … 0.5% for the first pick). */
export const LOTTERY_WEIGHTS = [
  140, 134, 127, 120, 105, 90, 75, 60, 45, 30, 20, 15, 10, 5,
] as const;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    const next = nextRandom(state);
    state = next.seed;
    return next.value;
  };
}

/** Version-1 drafts: worst record first, ties by team id. */
export function recordOrder(standings: Standing[]): number[] {
  return [...standings]
    .sort(
      (a, b) =>
        a.wins - b.wins ||
        a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst) ||
        a.teamId - b.teamId,
    )
    .map((row) => row.teamId);
}

/**
 * Worst record first. Teams level on wins and point differential are split by
 * a draw seeded from the season, so no club (including the user's id 0) wins
 * every tie.
 */
export function seededRecordOrder(
  standings: Standing[],
  seasonSeed: number,
): number[] {
  const roll = seededRandom((seasonSeed ^ 0x5eed7135) >>> 0);
  const tiebreak = new Map(
    [...standings]
      .sort((a, b) => a.teamId - b.teamId)
      .map((row) => [row.teamId, roll()]),
  );
  return [...standings]
    .sort(
      (a, b) =>
        a.wins - b.wins ||
        a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst) ||
        tiebreak.get(a.teamId)! - tiebreak.get(b.teamId)! ||
        a.teamId - b.teamId,
    )
    .map((row) => row.teamId);
}

/**
 * Version-2 drafts: the 14 non-playoff clubs draw for the first four picks
 * with weighted odds; the remaining lottery clubs, then the playoff field,
 * follow in reverse record order. Deterministic for a given season seed.
 */
export function lotteryOrder(
  standings: Standing[],
  seasonSeed: number,
): number[] {
  const order = seededRecordOrder(standings, seasonSeed);
  const lottery = order.slice(0, LOTTERY_TEAMS),
    field = order.slice(LOTTERY_TEAMS);
  const roll = seededRandom((seasonSeed ^ 0x10771e5) >>> 0);
  const weights = new Map(
    lottery.map((teamId, index) => [teamId, LOTTERY_WEIGHTS[index]]),
  );
  const winners: number[] = [];
  for (let draw = 0; draw < LOTTERY_DRAWS && lottery.length; draw++) {
    const remaining = lottery.filter((id) => !winners.includes(id));
    const total = remaining.reduce((sum, id) => sum + weights.get(id)!, 0);
    let ticket = roll() * total;
    const winner =
      remaining.find((id) => (ticket -= weights.get(id)!) < 0) ??
      remaining.at(-1)!;
    winners.push(winner);
  }
  return [
    ...winners,
    ...lottery.filter((id) => !winners.includes(id)),
    ...field,
  ];
}
