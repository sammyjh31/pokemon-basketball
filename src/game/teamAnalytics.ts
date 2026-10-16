import type { LeagueBox, LeagueResult } from "./types";
type Stats = Partial<
  Pick<
    LeagueBox,
    | "points"
    | "fgm"
    | "fga"
    | "threePM"
    | "threePA"
    | "fta"
    | "ftm"
    | "turnovers"
    | "offensiveRebounds"
    | "defensiveRebounds"
    | "assists"
    | "rimFga"
    | "midFga"
  >
>;
const keys = [
  "points",
  "fgm",
  "fga",
  "threePM",
  "threePA",
  "fta",
  "ftm",
  "turnovers",
  "offensiveRebounds",
  "defensiveRebounds",
  "assists",
  "rimFga",
  "midFga",
] as const;
export const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
export function totalStats(rows: Stats[]): Required<Stats> {
  return Object.fromEntries(
    keys.map((k) => [k, rows.reduce((n, p) => n + (p[k] ?? 0), 0)]),
  ) as Required<Stats>;
}
export function shootingSummary(p: Stats) {
  const t = totalStats([p]),
    attempts = t.fga + 0.44 * t.fta;
  const estimatedPossessions = Math.max(
    0,
    attempts - t.offensiveRebounds + t.turnovers,
  );
  return {
    ...t,
    estimatedPossessions,
    offensiveRating: ratio(t.points * 100, estimatedPossessions),
    efg: ratio((t.fgm + 0.5 * t.threePM) * 100, t.fga),
    ts: ratio(t.points * 100, 2 * attempts),
    turnoverRate: ratio(t.turnovers * 100, attempts + t.turnovers),
    freeThrowRate: ratio(t.fta * 100, t.fga),
    threeShare: ratio(t.threePA * 100, t.fga),
    rimShare: ratio(t.rimFga * 100, t.fga),
    midShare: ratio(t.midFga * 100, t.fga),
    assistTurnover: ratio(t.assists, t.turnovers),
  };
}
export function boxComparison(home: Stats[], away: Stats[]) {
  const h = shootingSummary(totalStats(home)),
    a = shootingSummary(totalStats(away));
  return {
    home: {
      ...h,
      offensiveReboundShare: ratio(
        h.offensiveRebounds * 100,
        h.offensiveRebounds + a.defensiveRebounds,
      ),
    },
    away: {
      ...a,
      offensiveReboundShare: ratio(
        a.offensiveRebounds * 100,
        a.offensiveRebounds + h.defensiveRebounds,
      ),
    },
  };
}
export function teamAnalysis(league: LeagueResult) {
  return league.teams.map((team) => {
    const players = league.players.filter((p) => p.teamId === team.id),
      standing = league.standings.find((s) => s.teamId === team.id);
    const games = (standing?.wins ?? 0) + (standing?.losses ?? 0),
      summary = shootingSummary(totalStats(players));
    return {
      ...summary,
      team,
      games,
      wins: standing?.wins ?? 0,
      pointsPerGame: ratio(standing?.pointsFor ?? 0, games),
      pointsAgainstPerGame: ratio(standing?.pointsAgainst ?? 0, games),
      offensiveReboundsPerGame: ratio(summary.offensiveRebounds, games),
      benchPointsPerGame: ratio(
        players
          .filter((p) => p.slot.startsWith("B"))
          .reduce((n, p) => n + p.points, 0),
        games,
      ),
    };
  });
}
