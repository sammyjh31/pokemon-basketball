import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { ROSTER_SLOTS } from "./types";
function teams() {
  const run = createRun("free", true, 517);
  run.roster = Object.fromEntries(
    ROSTER_SLOTS.map((s, i) => [s, [84, 92, 52, 95, 113, 66, 65, 1][i]]),
  ) as typeof run.roster;
  return createLeague(run);
}
it("applies physical abilities in complete simulations and keeps compact stats identical", () => {
  const [h, a] = teams();
  const game = simulateMatch(h, a, 84);
  const boxes = [...game.homeBox, ...game.awayBox];
  for (const key of ["movement", "screens", "rebounds", "energySaved"] as const)
    expect(
      boxes.reduce(
        (n, b) => n + (b.abilityActivations?.physical?.[key] ?? 0),
        0,
      ),
    ).toBeGreaterThan(0);
  const compact = simulateMatch(h, a, 84, { collectInsights: false });
  expect(compact.homeBox).toEqual(game.homeBox);
  expect(compact.awayBox).toEqual(game.awayBox);
  const old = simulateMatch(
    { ...h, physicalAbilityVersion: undefined },
    { ...a, physicalAbilityVersion: undefined },
    84,
  );
  expect(old.homeBox.every((b) => !b.abilityActivations?.physical)).toBe(true);
  expect(old.insights!.court!.map((c) => c.positions)).not.toEqual(
    game.insights!.court!.map((c) => c.positions),
  );
  expect(old.homeBox.map((b) => b.minutes)).not.toEqual(
    game.homeBox.map((b) => b.minutes),
  );
  const scores = (physical: boolean) =>
    [1, 22, 84, 428].map((seed) => {
      const g = simulateMatch(
        { ...h, physicalAbilityVersion: physical ? 1 : undefined },
        { ...a, physicalAbilityVersion: physical ? 1 : undefined },
        seed,
      );
      expect(g.homeBox.reduce((n, b) => n + b.points, 0)).toBe(g.homeScore);
      expect(g.awayBox.reduce((n, b) => n + b.points, 0)).toBe(g.awayScore);
      return [g.homeScore, g.awayScore];
    });
  expect(scores(true)).not.toEqual(scores(false));
});
it("makes disabled physical rules identical to no physical rules and rejects mismatched versions", () => {
  const [h, a] = teams();
  for (const t of [h, a])
    t.engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: false,
      familiarity: 0,
    };
  const enabledFlag = simulateMatch(h, a, 54);
  const absentFlag = simulateMatch(
    { ...h, physicalAbilityVersion: undefined },
    { ...a, physicalAbilityVersion: undefined },
    54,
  );
  expect(enabledFlag).toEqual(absentFlag);
  expect(() =>
    simulateMatch(h, { ...a, physicalAbilityVersion: undefined }, 54),
  ).toThrow(/physical ability/);
});
