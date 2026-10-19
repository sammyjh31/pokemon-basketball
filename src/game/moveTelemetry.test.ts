import { expect, it } from "vitest";
import { sameMoveStats } from "./moveTelemetry";

it("reconciles known move totals exactly even when old summary seasons have no move records", () => {
  const known = { uses: { protect: 3 }, energySpent: 10.5, energyRecovered: 0 };
  expect(sameMoveStats(known, structuredClone(known))).toBe(true);
  expect(sameMoveStats(undefined, undefined)).toBe(true);
  expect(
    sameMoveStats({ uses: {}, energySpent: 0, energyRecovered: 0 }, undefined),
  ).toBe(true);
  expect(sameMoveStats({ ...known, uses: { protect: 4 } }, known)).toBe(false);
  expect(sameMoveStats({ ...known, energySpent: 11.5 }, known)).toBe(false);
  expect(sameMoveStats({ ...known, energyRecovered: 1 }, known)).toBe(false);
  expect(sameMoveStats(known, undefined)).toBe(false);
});
