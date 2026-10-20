import { expect, it } from "vitest";
import {
  emptyMoveStats,
  mergeMoveStats,
  sameMoveStats,
  validateMoveStats,
} from "./moveTelemetry";
const known = () => ({
  uses: { "pikachu-volt-tackle": 1 },
  energySpent: 14.2,
  energyRecovered: 0,
  combos: { attempts: { "pick-roll": 2 }, shotsCreated: { "pick-roll": 1 } },
});
it("aggregates exact participant combo totals without changing legacy move shapes", () => {
  const value = known();
  expect(validateMoveStats(value)).toEqual(value);
  const sum = emptyMoveStats();
  mergeMoveStats(sum, value);
  mergeMoveStats(sum, value);
  expect(sum).toMatchObject({
    energySpent: 28.4,
    combos: { attempts: { "pick-roll": 4 }, shotsCreated: { "pick-roll": 2 } },
  });
  expect(sameMoveStats(sum, structuredClone(sum))).toBe(true);
  expect(
    sameMoveStats(value, {
      ...value,
      combos: {
        attempts: { "pick-roll": 3 },
        shotsCreated: { "pick-roll": 1 },
      },
    }),
  ).toBe(false);
  expect(sameMoveStats(value, undefined)).toBe(false);
  const old = { uses: { protect: 2 }, energySpent: 7, energyRecovered: 0 };
  expect(validateMoveStats(old)).toEqual(old);
  expect(mergeMoveStats(emptyMoveStats(), old)).toBeUndefined();
  expect(JSON.stringify(validateMoveStats(old))).not.toContain("combos");
});
it("rejects impossible, unknown, fractional and unbounded combo evidence", () => {
  for (const combos of [
    { attempts: { "pick-roll": 1 }, shotsCreated: { "pick-roll": 2 } },
    { attempts: {}, shotsCreated: { "pick-roll": 1 } },
    { attempts: { unknown: 1 }, shotsCreated: {} },
    { attempts: { "pick-roll": 0.5 }, shotsCreated: {} },
    { attempts: { "pick-roll": -1 }, shotsCreated: {} },
    { attempts: { "pick-roll": 1e10 }, shotsCreated: {} },
    { attempts: { "pick-roll": Infinity }, shotsCreated: {} },
    { attempts: [], shotsCreated: {} },
    { attempts: {}, shotsCreated: {}, extra: 1 },
    null,
  ])
    expect(() => validateMoveStats({ ...known(), combos })).toThrow();
});
