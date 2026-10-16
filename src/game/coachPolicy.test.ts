import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { coachGamePlan, coachAdjustment } from "./coachPolicy";
import { getCoach } from "./trainerCoaches";
const team = () =>
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
  })[0];
it("gives the same roster different workload and offensive plans under different trainers", () => {
  const t = team(),
    original = JSON.stringify(t);
  const ash = coachGamePlan({ ...t, coach: { version: 1, id: "ash" } });
  const mom = coachGamePlan({ ...t, coach: { version: 1, id: "mom" } });
  expect(ash.tactic).not.toBe(mom.tactic);
  expect(mom.rotation).toBe("bench");
  expect(ash.rotation).toBe("starters");
  expect(ash.reason.length).toBeGreaterThan(30);
  expect(JSON.stringify(t)).toBe(original);
});
it("responds to observed shot selection and late score without consuming randomness", () => {
  const observation = {
    minute: 46,
    margin: -9,
    energy: 80,
    opponentAttempts: 20,
    opponentThrees: 14,
    opponentRim: 3,
  };
  const choice = coachAdjustment(getCoach("oak")!, observation);
  expect(choice.tactic).toBe("perimeter");
  expect(choice.defense).toBe("press");
  expect(
    coachAdjustment(getCoach("oak")!, { ...observation, minute: 24, margin: 0 })
      .defense,
  ).toBe("switch");
  expect(
    coachAdjustment(getCoach("mom")!, {
      ...observation,
      minute: 24,
      margin: 3,
      energy: 45,
    }).tactic,
  ).toBe("balanced");
});
