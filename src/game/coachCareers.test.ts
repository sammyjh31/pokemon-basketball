import { expect, it } from "vitest";
import {
  captureCoachRecords,
  coachCareers,
  validateCoachRecords,
} from "./coachCareers";
import type { Playoffs } from "./playoffTypes";
import type { Standing } from "./types";
const teams = [
  { id: 0, coach: { version: 1 as const, id: "ash" } },
  { id: 1, coach: { version: 1 as const, id: "mom" } },
];
const standings = [
  { teamId: 0, wins: 50, losses: 32, pointsFor: 9000, pointsAgainst: 8000 },
  { teamId: 1, wins: 40, losses: 42, pointsFor: 8000, pointsAgainst: 9000 },
] as Standing[];
const playoffs = {
  seeds: [
    { teamId: 0, seed: 1 },
    { teamId: 1, seed: 2 },
  ],
  series: [
    {
      round: 3,
      higherSeedId: 0,
      lowerSeedId: 1,
      higherSeedWins: 4,
      lowerSeedWins: 2,
      winnerId: 0,
    },
  ],
  championId: 0,
} as Playoffs;
it("attributes records to the coach who played that year, including each playoff series", () => {
  const first = captureCoachRecords(teams, standings, playoffs, 1);
  const second = captureCoachRecords(
    [...teams].reverse().map((t, i) => ({ ...t, id: i })),
    standings,
    undefined,
    2,
  );
  const ash = coachCareers([...first, ...second]).find(
    (r) => r.coach.id === "ash",
  )!;
  expect([
    ash.wins,
    ash.losses,
    ash.playoffWins,
    ash.playoffLosses,
    ash.championships,
  ]).toEqual([90, 74, 4, 2, 1]);
  expect(ash.seasons.map((s) => s.teamId)).toEqual([0, 1]);
  expect(ash.seasons[1].complete).toBe(false);
  expect(ash.finalsAppearances).toBe(1);
});
it("bounds compact history and rejects incompatible or asymmetric series results", () => {
  const rows = captureCoachRecords(teams, standings, playoffs, 1);
  const parse = (data: unknown) =>
    validateCoachRecords(data, teams, standings, 1, 0, 2, 7, 6);
  expect(parse(rows)).toEqual(rows);
  for (const mutate of [
    (r: typeof rows) => {
      r[0].wins++;
    },
    (r: typeof rows) => {
      r[0].rounds[0].losses = 1;
    },
    (r: typeof rows) => {
      r[0].coachId = "mom";
    },
    (r: typeof rows) => {
      r[1].champion = true;
    },
  ]) {
    const bad = structuredClone(rows);
    mutate(bad);
    expect(() => parse(bad)).toThrow();
  }
});
