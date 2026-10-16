/** Role-indexed coaching bonuses, in the same scale as basketball fit ratings.
 * Value both attacking coverage and resistance, with most weight on the direct
 * opponent and some on the other four players who can switch or help. */
export function typeLineupBonuses<T>(
  player: T,
  opponents: readonly T[],
  edge: (attacker: T, defender: T) => number,
): number[] {
  if (!opponents.length) return [];
  const matchups = opponents.map(
    (opponent) => edge(player, opponent) - edge(opponent, player),
  );
  const coverage =
    matchups.reduce((sum, value) => sum + value, 0) / matchups.length;
  // At most +/-12 points: a useful counter cannot erase a severe skill or energy deficit.
  return matchups.map((value) => 3 * (value * 0.65 + coverage * 0.35));
}
