import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { snapshotChemistry } from "./teammateChemistry";
const teams = () =>
  createLeague({
    ...createRun("free", true, 772),
    roster: { PG: 65, SG: 135, SF: 68, PF: 95, C: 113, B1: 92, B2: 52, B3: 25 },
  });
it("collects actual shared minutes in full and compact matches with player and clock conservation", () => {
  const [h, a] = teams(),
    before = JSON.stringify([h, a]);
  const game = simulateMatch(h, a, 77),
    compact = simulateMatch(h, a, 77, { collectInsights: false });
  expect(compact.chemistryMinutes).toEqual(game.chemistryMinutes);
  expect(compact.homeBox).toEqual(game.homeBox);
  for (const side of ["home", "away"] as const) {
    const pairs = game.chemistryMinutes![side],
      boxes = game[`${side}Box`];
    expect(
      Math.abs(
        Object.values(pairs).reduce((x, y) => x + y, 0) -
          10 * (48 + 5 * game.overtimePeriods),
      ),
    ).toBeLessThan(0.15);
    for (const p of boxes) {
      const shared = Object.entries(pairs)
        .filter(([key]) => key.split(":").map(Number).includes(p.pokemonId))
        .reduce((n, [, m]) => n + m, 0);
      expect(Math.abs(shared - 4 * p.minutes)).toBeLessThan(0.08);
    }
  }
  expect(JSON.stringify([h, a])).toBe(before);
});
it("freezes pregame history for box-score replay and never mutates history during a preview", () => {
  const [h, a] = teams();
  h.chemistryBonds = { "65:68": 1000, "65:95": 800 };
  const context = snapshotChemistry(h, a)!;
  const before = simulateMatch(h, a, 12, { chemistry: context });
  h.chemistryBonds = { "65:68": 4000 };
  expect(simulateMatch(h, a, 12, { chemistry: context })).toEqual(before);
  expect(simulateMatch(h, a, 12).insights!.lineups).not.toEqual(
    before.insights!.lineups,
  );
  expect(() =>
    simulateMatch(h, { ...a, chemistryGrowthVersion: undefined }, 12),
  ).toThrow(/growth/);
});
