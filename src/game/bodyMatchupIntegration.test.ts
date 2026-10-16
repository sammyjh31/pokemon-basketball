import { expect, it } from "vitest";
import { createLeague } from "./league";
import { createRun } from "./draft";
import { simulateMatch } from "./match";
const teams = () =>
  createLeague({
    ...createRun("free", true, 882),
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  }).map((t) => ({
    ...t,
    matchupVersion: 1 as const,
    simulationVersion: 2 as const,
  }));
it("resolves physical and type contests on actual shots with deterministic accounting", () => {
  const clubs = teams();
  let won = 0,
    contained = 0,
    kickouts = 0;
  for (let seed = 1; seed <= 12; seed++) {
    const [h, a] = [clubs[seed], clubs[seed + 12]],
      before = JSON.stringify([h, a]);
    const m = simulateMatch(h, a, seed),
      compact = simulateMatch(h, a, seed, { collectInsights: false });
    expect(m.insights!.shots.every((s) => s.matchup)).toBe(true);
    expect(m).toEqual(simulateMatch(h, a, seed));
    expect({ ...m, insights: undefined }).toEqual(compact);
    expect(JSON.stringify([h, a])).toBe(before);
    for (const side of ["home", "away"] as const) {
      const box = m[`${side}Box`];
      expect(box.reduce((n, b) => n + 2 * b.fgm + b.threePM + b.ftm, 0)).toBe(
        m[`${side}Score`],
      );
      expect(box.reduce((n, b) => n + b.minutes, 0)).toBe(
        240 + 25 * m.overtimePeriods,
      );
    }
    for (const s of m.insights!.shots) {
      const e = s.matchup!;
      expect(e.attackerId).toBe(s.shooterId);
      expect(e.defenderId).toBe(s.defenderId);
      expect(e.advantageChance).toBeGreaterThan(0);
      expect(e.advantageChance).toBeLessThan(1);
      expect(s.expectedProbability).toBeGreaterThan(0);
      expect(s.expectedProbability).toBeLessThan(1);
      won += Number(e.won);
      contained += Number(!e.won);
      kickouts += Number(s.kickout);
      if (s.kickout) expect(e.action).not.toBe("post seal");
    }
  }
  expect(won).toBeGreaterThan(100);
  expect(contained).toBeGreaterThan(100);
  expect(kickouts).toBeGreaterThan(0);
});
it("rejects unknown and mixed matchup models, and leaves old models unannotated", () => {
  const [h, a] = teams();
  expect(() =>
    simulateMatch(h, { ...a, matchupVersion: undefined }, 1),
  ).toThrow();
  expect(() =>
    simulateMatch(
      { ...h, matchupVersion: 2 as 1 },
      { ...a, matchupVersion: 2 as 1 },
      1,
    ),
  ).toThrow();
  const m = simulateMatch(
    { ...h, matchupVersion: undefined },
    { ...a, matchupVersion: undefined },
    1,
  );
  expect(m.insights!.shots.every((s) => s.matchup === undefined)).toBe(true);
});
