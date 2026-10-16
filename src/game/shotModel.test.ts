import { describe, it, expect } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { evaluateShot, type ShotContext } from "./shotModel";
const profile = playerProfile(POKEMON_BY_ID.get(65)!);
const base: ShotContext = {
  shooter: profile,
  defender: profile,
  shooterHeight: 1.5,
  defenderHeight: 1.5,
  zone: "three",
  play: "spotUp",
  coverage: "man",
};
describe("explainable model 2 shot odds", () => {
  it("rewards shooting and spacing, penalizes stronger contests and tired shooters", () => {
    const normal = evaluateShot(base).probability;
    expect(evaluateShot({ ...base, spacing: 90 }).probability).toBeGreaterThan(
      normal,
    );
    expect(
      evaluateShot({ ...base, shooterEnergy: 25 }).probability,
    ).toBeLessThan(normal);
    expect(
      evaluateShot({ ...base, roleFitPenalty: 30 }).probability,
    ).toBeLessThan(normal);
    expect(
      evaluateShot({
        ...base,
        shooter: {
          ...profile,
          attributes: { ...profile.attributes, threePoint: 100 },
        },
      }).probability,
    ).toBeGreaterThan(normal);
    expect(
      evaluateShot({
        ...base,
        defender: {
          ...profile,
          attributes: { ...profile.attributes, perimeterDefense: 100 },
        },
      }).probability,
    ).toBeLessThan(normal);
  });
  it("models zone tradeoffs and bounded physical mismatches without automatic makes", () => {
    expect(
      evaluateShot({ ...base, coverage: "zone" }).probability,
    ).toBeGreaterThan(evaluateShot(base).probability);
    expect(
      evaluateShot({ ...base, zone: "rim", coverage: "zone" }).probability,
    ).toBeLessThan(evaluateShot({ ...base, zone: "rim" }).probability);
    const tall = evaluateShot({
      ...base,
      zone: "rim",
      shooterHeight: 3.5,
    }).probability;
    expect(tall).toBeGreaterThan(
      evaluateShot({ ...base, zone: "rim" }).probability,
    );
    expect(
      evaluateShot({ ...base, zone: "rim", shooterHeight: 20 }).probability,
    ).toBe(tall);
    for (const zone of ["rim", "mid", "three"] as const)
      for (const shooterEnergy of [0, 50, 100]) {
        const p = evaluateShot({
          ...base,
          zone,
          shooterEnergy,
          spacing: 100,
        }).probability;
        expect(p).toBeGreaterThanOrEqual(0.1);
        expect(p).toBeLessThanOrEqual(0.88);
      }
  });
  it("explains changes in percentage points that sum to the exact probability", () => {
    const shot = evaluateShot({ ...base, shooterEnergy: 50, spacing: 80 });
    expect(
      shot.baseProbability + shot.factors.reduce((n, f) => n + f.change, 0),
    ).toBeCloseTo(shot.probability, 12);
    expect(
      shot.factors.find((f) => f.label === "Fatigue")!.change,
    ).toBeLessThan(0);
  });
});
