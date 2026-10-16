import { expect, it } from "vitest";
import { rookieFixture } from "./rookieDraft.testUtils";
import { assignLeagueCoaches } from "./trainerCoaches";
import {
  changeCoach,
  projectedCoaches,
  reviewCpuCoaches,
  validateCoachOffice,
} from "./coachOffice";
const setup = () => {
  const s = rookieFixture();
  const teams = assignLeagueCoaches(
    s.franchise!.teams,
    21,
    new Map([[0, { version: 1, id: "ash" }]]),
  );
  return { teams, standings: s.franchise!.history[0].standings };
};
it("fires and rehires without touching frozen teams and rejects occupied coaches", () => {
  const { teams } = setup(),
    before = JSON.stringify(teams);
  const fired = changeCoach(undefined, teams, 1, 0, null, [0]);
  expect(projectedCoaches(teams, fired, 1)[0].coach).toBeUndefined();
  expect(JSON.stringify(teams)).toBe(before);
  expect(() =>
    changeCoach(fired, teams, 1, 0, teams[1].coach!.id, [0]),
  ).toThrow(/available/);
  const hired = changeCoach(fired, teams, 1, 0, "ash", [0]);
  expect(projectedCoaches(teams, hired, 1)[0].coach?.id).toBe("ash");
  expect(hired.years[0].changes).toHaveLength(2);
  expect(() => changeCoach(hired, teams, 1, 1, null, [0])).toThrow(/human/);
});
it("reviews CPUs once, preserves humans and finalists, and keeps all jobs unique", () => {
  const { teams, standings } = setup();
  const input = {
    teams,
    standings,
    year: 1,
    seed: 7,
    humanTeamIds: [0, 2],
    championId: 29,
    finalistIds: [28, 29],
    priorRecords: [],
  };
  const office = reviewCpuCoaches(undefined, input);
  expect(office.years[0].cpuProcessed).toBe(true);
  expect(office.years[0].changes.length).toBeGreaterThan(0);
  expect(
    office.years[0].changes.some((c) => [0, 2, 28, 29].includes(c.teamId)),
  ).toBe(false);
  const next = projectedCoaches(teams, office, 1);
  expect(new Set(next.map((t) => t.coach?.id)).size).toBe(30);
  expect(next.every((t) => t.coach)).toBe(true);
  expect(reviewCpuCoaches(office, input)).toBe(office);
  expect(reviewCpuCoaches(undefined, input)).toEqual(office);
  expect(validateCoachOffice(office, 30, 1, [0, 2])).toEqual(office);
  const corrupt = structuredClone(office);
  corrupt.years[0].changes[0].from = "unknown";
  expect(() => validateCoachOffice(corrupt, 30, 1, [0, 2])).toThrow();
});
