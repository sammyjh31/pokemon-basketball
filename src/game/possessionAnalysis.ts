import type {
  PossessionInsights,
  PossessionPlayer,
  PossessionTeam,
} from "./possessionTypes";
/** Sum only observed samples; missing games never enter these denominators. */
export function mergePossessionInsights(
  a: PossessionInsights,
  b: PossessionInsights,
): PossessionInsights {
  const merge = <T extends PossessionPlayer | PossessionTeam>(
    left: T[],
    right: T[],
    key: (row: T) => string,
  ): T[] => {
    const rows = new Map(left.map((r) => [key(r), { ...r }]));
    for (const row of right) {
      const id = key(row),
        prior = rows.get(id);
      if (!prior) {
        rows.set(id, { ...row });
        continue;
      }
      for (const field of Object.keys(row) as (keyof T)[]) {
        if (field === "teamId" || field === "playerId") continue;
        if (typeof row[field] === "number")
          (prior as Record<keyof T, unknown>)[field] =
            Number(prior[field]) + Number(row[field]);
      }
    }
    return [...rows.values()];
  };
  return {
    version: 1,
    teams: merge(a.teams, b.teams, (r) => String(r.teamId)),
    players: merge(a.players, b.players, (r) => r.playerId),
  };
}
