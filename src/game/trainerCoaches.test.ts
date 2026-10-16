import { expect, it } from "vitest";
import {
  COACHES,
  coachOffers,
  validateCoach,
  assignLeagueCoaches,
} from "./trainerCoaches";
import { createRun } from "./draft";
import { createLeague } from "./league";
export const coachClubs = () =>
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
  });
it("offers three stable distinct choices and reserves the human coach before assigning 29 CPUs", () => {
  expect(COACHES).toHaveLength(32);
  expect(new Set(COACHES.map((c) => c.id)).size).toBe(32);
  const offers = coachOffers(123);
  expect(offers).toHaveLength(3);
  expect(new Set(offers.map((c) => c.id)).size).toBe(3);
  expect(coachOffers(123)).toEqual(offers);
  expect(coachOffers(124)).not.toEqual(offers);
  const teams = coachClubs(),
    before = JSON.stringify(teams);
  const assigned = assignLeagueCoaches(
    teams,
    55,
    new Map([[0, { version: 1, id: "mom" }]]),
  );
  expect(assigned[0].coach?.id).toBe("mom");
  expect(new Set(assigned.map((t) => t.coach?.id)).size).toBe(30);
  expect(assigned).toEqual(
    assignLeagueCoaches(teams, 55, new Map([[0, { version: 1, id: "mom" }]])),
  );
  expect(JSON.stringify(teams)).toBe(before);
  expect(() =>
    assignLeagueCoaches(
      teams,
      1,
      new Map([
        [0, { version: 1, id: "mom" }],
        [1, { version: 1, id: "mom" }],
      ]),
    ),
  ).toThrow();
});
it("rejects unknown or unsupported coach assignments", () => {
  expect(validateCoach({ version: 1, id: "ash" })).toEqual({
    version: 1,
    id: "ash",
  });
  for (const value of [
    undefined,
    null,
    "ash",
    { id: "ash" },
    { version: 2, id: "ash" },
    { version: 1, id: "missing" },
  ])
    expect(validateCoach(value)).toBeUndefined();
});
