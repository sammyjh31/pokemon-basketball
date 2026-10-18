import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
const clubs = (
  roster = {
    PG: 65,
    SG: 135,
    SF: 149,
    PF: 68,
    C: 143,
    B1: 121,
    B2: 6,
    B3: 131,
  },
) => createLeague({ ...createRun("free", true, 882), roster });
it("coaches both teams in the shared engine with deterministic, report-independent decisions", () => {
  const teams = clubs();
  const h = { ...teams[0], coach: { version: 1 as const, id: "ash" } },
    a = { ...teams[5], coach: { version: 1 as const, id: "mom" } };
  const before = JSON.stringify([h, a]),
    m = simulateMatch(h, a, 711);
  expect(m.insights?.coaches).toHaveLength(2);
  expect(m.insights!.coaches![0].coachId).toBe("ash");
  expect(m.insights!.coaches![0].starters).toEqual(
    m.homeBox.filter((p) => p.started).map((p) => p.pokemonId),
  );
  expect(m.insights!.adjustments.length).toBeGreaterThan(0);
  expect({ ...m, insights: undefined }).toEqual(
    simulateMatch(h, a, 711, { collectInsights: false }),
  );
  expect(m).toEqual(simulateMatch(h, a, 711));
  expect(JSON.stringify([h, a])).toBe(before);
  for (const side of ["home", "away"] as const) {
    expect(m[`${side}Box`].reduce((n, p) => n + p.minutes, 0)).toBeCloseTo(
      240 + 25 * m.overtimePeriods,
      8,
    );
    expect(m[`${side}Box`].reduce((n, p) => n + p.points, 0)).toBe(
      m[`${side}Score`],
    );
  }
  const other = simulateMatch(
    { ...h, coach: { version: 1, id: "brock" } },
    a,
    711,
  );
  expect(other.homeBox).not.toEqual(m.homeBox);
  expect(() =>
    simulateMatch({ ...h, coach: { version: 1, id: "unknown" } }, a, 711),
  ).toThrow();
});
it("coach minutes can elevate a stronger reserve instead of preserving a weak nominal starter", () => {
  const [h, a] = clubs({
    PG: 10,
    SG: 13,
    SF: 11,
    PF: 14,
    C: 129,
    B1: 150,
    B2: 149,
    B3: 249,
  });
  const m = simulateMatch(
    {
      ...h,
      coach: { version: 1, id: "cynthia" },
    },
    a,
    31,
  );
  const targets = m.insights!.coaches![0].minutes;
  expect(targets.B1).toBeGreaterThan(targets.PG);
  expect(Object.values(targets).reduce((n, x) => n + x, 0)).toBe(240);
  expect(
    m.homeBox.filter((p) => p.started).some((p) => p.slot.startsWith("B")),
  ).toBe(true);
});
