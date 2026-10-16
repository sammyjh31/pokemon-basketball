import { expect, it } from "vitest";
import { shootingSummary, boxComparison, teamAnalysis } from "./teamAnalytics";
import type { LeagueBox, LeagueResult } from "./types";
const own = {
  points: 100,
  fgm: 36,
  fga: 80,
  threePM: 12,
  threePA: 30,
  ftm: 16,
  fta: 20,
  turnovers: 12,
  offensiveRebounds: 8,
  defensiveRebounds: 30,
  assists: 24,
  rimFga: 30,
  midFga: 20,
} as LeagueBox;
it("computes advanced rates from attempts and handles zero denominators", () => {
  const s = shootingSummary(own);
  expect(s.efg).toBe(52.5);
  expect(s.ts).toBeCloseTo(56.3063, 3);
  expect(s.estimatedPossessions).toBeCloseTo(92.8);
  expect(s.offensiveRating).toBeCloseTo(107.7586, 3);
  expect(s.turnoverRate).toBeCloseTo((12 / 100.8) * 100);
  expect(s.freeThrowRate).toBe(25);
  expect(s.threeShare).toBe(37.5);
  expect(shootingSummary({}).efg).toBeNull();
  expect(shootingSummary({}).offensiveRating).toBeNull();
});
it("uses the actual opposing rebounds for game rebound share", () => {
  const comparison = boxComparison([own], [{ ...own, defensiveRebounds: 24 }]);
  expect(comparison.home.offensiveReboundShare).toBe(25);
  expect(comparison.away.offensiveReboundShare).toBeCloseTo((8 / 38) * 100);
});
it("separates season bench scoring and actual points allowed from estimates", () => {
  const league = {
    teams: [{ id: 3, name: "Example" }],
    standings: [
      { teamId: 3, wins: 1, losses: 1, pointsFor: 100, pointsAgainst: 90 },
    ],
    players: [
      { ...own, teamId: 3, slot: "PG" },
      {
        ...own,
        teamId: 3,
        slot: "B1",
        points: 20,
        fga: 10,
        fgm: 8,
        threePM: 0,
        threePA: 0,
        fta: 4,
        ftm: 4,
        turnovers: 0,
        offensiveRebounds: 0,
      },
    ],
  } as unknown as LeagueResult;
  const team = teamAnalysis(league)[0];
  expect(team.benchPointsPerGame).toBe(10);
  expect(team.pointsAgainstPerGame).toBe(45);
  expect(team.offensiveReboundsPerGame).toBe(4);
});
