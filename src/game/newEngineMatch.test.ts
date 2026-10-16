import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
const teams = createLeague({
  ...createRun("free", false, 42),
  // Compare the two historical shot models without the new type-rule layer.
  matchupVersion: undefined,
  typeMatchupsVersion: undefined,
  typeTacticsVersion: undefined,
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("uses model 2 in real games, reports shot expectation and preserves basketball accounting", () => {
  const home = { ...teams[0], simulationVersion: 2 as const },
    away = { ...teams[1], simulationVersion: 2 as const };
  const first = simulateMatch(home, away, 1);
  expect(first.shotQuality).toBeDefined();
  expect(first).toEqual(simulateMatch(home, away, 1));
  expect(first.homeBox).not.toEqual(
    simulateMatch(teams[0], teams[1], 1).homeBox,
  );
  for (let seed = 1; seed <= 20; seed++) {
    const m = simulateMatch(home, away, seed);
    for (const [side, box, score] of [
      ["home", m.homeBox, m.homeScore],
      ["away", m.awayBox, m.awayScore],
    ] as const) {
      expect(box.reduce((n, p) => n + p.minutes, 0)).toBe(
        240 + 25 * m.overtimePeriods,
      );
      expect(box.reduce((n, p) => n + 2 * p.fgm + p.threePM + p.ftm, 0)).toBe(
        score,
      );
      const q = m.shotQuality![side];
      expect(q.attempts).toBeGreaterThan(0);
      expect(q.attempts).toBeLessThanOrEqual(
        box.reduce((n, p) => n + p.fga, 0),
      );
      expect(q.expectedPoints).toBeGreaterThan(0);
      expect(q.expectedPoints).toBeLessThan(q.attempts * 3);
      expect(q.points).toBeLessThanOrEqual(score);
    }
  }
});
