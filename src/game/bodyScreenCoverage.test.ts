import { expect, it, vi } from "vitest";
import * as model from "./bodyMatchups";
import * as tactics from "./typeTactics";
import { simulateMatch } from "./match";
import { createRun } from "./draft";
import { createLeague } from "./league";
// Observe the real model at the coaching boundary; both spies call through unchanged.
it("the help probe uses the screen coverage actually chosen on the floor", () => {
  const clubs = createLeague({
    ...createRun("free", true, 882),
    courtVersion: undefined, // Exercise the frozen abstract screen/help model.
    gameFlowVersion: undefined,
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
  });
  const resolve = model.resolveBodyMatchup,
    switchScreen = tactics.shouldSwitchScreen;
  let pending:
    | { scheme: Parameters<typeof switchScreen>[4]; switched: boolean }
    | undefined;
  const comparisons: [number, number][] = [];
  const switchSpy = vi
    .spyOn(tactics, "shouldSwitchScreen")
    .mockImplementation((...args) => {
      const switched = switchScreen(...args);
      pending = { scheme: args[4], switched };
      return switched;
    });
  const bodySpy = vi
    .spyOn(model, "resolveBodyMatchup")
    .mockImplementation((a, d, c, roll) => {
      const actual = resolve(a, d, c, roll);
      if (pending && c.play === "pickRoll") {
        const coverage = tactics.screenCoverage(
          pending.scheme,
          pending.switched,
        );
        if (coverage !== pending.scheme)
          comparisons.push([
            actual.advantageChance,
            resolve(a, d, { ...c, coverage }, roll).advantageChance,
          ]);
        pending = undefined;
      }
      return actual;
    });
  try {
    for (let seed = 1; seed <= 8; seed++)
      simulateMatch(
        { ...clubs[seed], defense: "man" },
        { ...clubs[seed + 10], defense: "switch" },
        seed,
      );
    expect(comparisons.length).toBeGreaterThan(10);
    for (const [actual, expected] of comparisons)
      expect(actual).toBeCloseTo(expected, 12);
  } finally {
    bodySpy.mockRestore();
    switchSpy.mockRestore();
  }
});
