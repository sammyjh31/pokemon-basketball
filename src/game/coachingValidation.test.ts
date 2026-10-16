import { describe, expect, it } from "vitest";
import { defaultRotationPlan, validateRotationPlan } from "./rotationPlan";
import { validateTrainingPlans } from "./training";
import type { RotationPlan } from "./franchiseFeatures";
import type { Roster } from "./types";

const roster: Roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const plan = (): RotationPlan => ({
  minutes: { PG: 40, SG: 40, SF: 40, PF: 40, C: 40, B1: 20, B2: 20, B3: 0 },
  closing: ["PG", "SG", "SF", "PF", "C"],
});

describe("coaching input validation", () => {
  it("accepts valid targets, creates complete defaults, and returns isolated values", () => {
    const original = plan(),
      checked = validateRotationPlan(original);
    checked.minutes.PG = 0;
    checked.closing.reverse();
    expect(original.minutes.PG).toBe(40);
    expect(original.closing[0]).toBe("PG");
    for (const rotation of ["balanced", "starters", "bench"] as const) {
      const defaults = defaultRotationPlan(roster, rotation);
      expect(validateRotationPlan(defaults)).toEqual(defaults);
    }
  });

  it.each([
    null,
    [],
    {},
    { ...plan(), minutes: { ...plan().minutes, B3: 1 } },
    { ...plan(), minutes: { ...plan().minutes, PG: 49, SG: 31 } },
    { ...plan(), minutes: { ...plan().minutes, PG: 39.5, SG: 40.5 } },
    { ...plan(), minutes: { ...plan().minutes, PG: NaN } },
    { ...plan(), minutes: { ...plan().minutes, PG: -1, SG: 81 } },
    { ...plan(), closing: ["PG", "PG", "SF", "PF", "C"] },
    { ...plan(), closing: ["PG", "SG", "SF", "PF", "B3"] },
    { ...plan(), closing: ["PG", "SG", "SF", "PF", "bad"] },
    { ...plan(), closing: ["PG", "SG", "SF", "PF"] },
    { ...plan(), minutes: { ...plan().minutes, extra: 0 } },
  ])("rejects malformed minute or closing plans %#", (value) => {
    expect(() => validateRotationPlan(value)).toThrow();
  });

  it("accepts only owned players and valid focus, intensity and target position", () => {
    const original = {
      65: { focus: "position", intensity: "steady", position: "C" },
      131: { focus: "shooting", intensity: "aggressive" },
    };
    const checked = validateTrainingPlans(original, roster);
    expect(checked).toEqual(original);
    checked[65]!.position = "PG";
    expect(original[65].position).toBe("C");
    expect(validateTrainingPlans({}, roster)).toEqual({});
    for (const value of [
      null,
      [],
      { 150: { focus: "shooting", intensity: "standard" } },
      { 65: { focus: "magic", intensity: "standard" } },
      { 65: { focus: "shooting", intensity: "extreme" } },
      { 65: { focus: "position", intensity: "standard" } },
      { 65: { focus: "position", intensity: "standard", position: "coach" } },
      { "065": { focus: "balanced", intensity: "standard" } },
      { 65: { focus: "balanced", intensity: "standard", bonus: 100 } },
    ])
      expect(() => validateTrainingPlans(value, roster)).toThrow();
  });
});
