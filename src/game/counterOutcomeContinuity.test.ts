import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { seedCoachScouting, parseCoachBook } from "./scoutingContinuity";
import { emptyScouting } from "./opponentScouting";
import { emptyCounterResults, emptyCounterSample } from "./counterLearning";
import type { CoachBook } from "./scoutingContinuityTypes";
it("attenuates outcome evidence after roster/coach changes and follows the observing coach's job", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 4 });
  const results = emptyCounterResults();
  results.counters["switch-deny"] = {
    used: { ...emptyCounterSample(), attacks: 20, points: 15, energy: 120 },
    without: { ...emptyCounterSample(), attacks: 10, points: 20 },
  };
  const coach = teams[0].coach!.id;
  const book: CoachBook = {
    version: 1,
    year: 1,
    teams: teams.map((t) => ({
      id: t.id,
      roster: Object.values(t.roster) as number[],
      coachId: t.coach!.id,
    })),
    coaches: {
      [coach]: {
        teamId: 0,
        opponents: {
          1: {
            ...emptyScouting(),
            games: 3,
            possessions: 100,
            counterResults: results,
          },
        },
      },
    },
  };
  expect(
    parseCoachBook(
      book,
      1,
      book.teams.map((t) => t.roster),
    ),
  ).toEqual(book);
  const history = [{ year: 1, coachBook: book }];
  const before = seedCoachScouting(history, teams, 2)[0].scoutingSeed!
    .opponents[1].scouting.counterResults!.counters["switch-deny"]!.used
    .attacks;
  expect(before).toBe(14.4);
  const changed = structuredClone(teams);
  [changed[1].roster.PG, changed[2].roster.PG] = [
    changed[2].roster.PG,
    changed[1].roster.PG,
  ];
  [changed[1].coach, changed[2].coach] = [changed[2].coach, changed[1].coach];
  [changed[0].coach, changed[3].coach] = [changed[3].coach, changed[0].coach];
  const next = seedCoachScouting(history, changed, 2);
  const own =
    next[3].scoutingSeed!.opponents[1].scouting.counterResults!.counters[
      "switch-deny"
    ]!.used.attacks;
  expect(own).toBeCloseTo(((14.4 * 7) / 8) * 0.45, 6);
  const handed =
    next[0].scoutingSeed!.opponents[1].scouting.counterResults!.counters[
      "switch-deny"
    ]!.used.attacks;
  expect(handed).toBeCloseTo(own * 0.35, 6);
  expect(
    next[3].scoutingSeed!.opponents[2]?.scouting.counterResults,
  ).toBeUndefined();
  expect(seedCoachScouting([], teams, 2).every((t) => !t.scoutingSeed)).toBe(
    true,
  );
});
it("keeps recent outcome learning when a larger legacy report wins general system scouting", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 4 });
  const coach = teams[0].coach!.id,
    metadata = teams.map((t) => ({
      id: t.id,
      roster: Object.values(t.roster) as number[],
      coachId: t.coach!.id,
    }));
  const results = emptyCounterResults();
  results.counters["top-lock"] = {
    used: { ...emptyCounterSample(), attacks: 10, points: 10 },
    without: { ...emptyCounterSample(), attacks: 10, points: 20 },
  };
  const older: CoachBook = {
    version: 1,
    year: 1,
    teams: metadata,
    coaches: {
      [coach]: {
        teamId: 0,
        opponents: { 1: { ...emptyScouting(), games: 6, possessions: 300 } },
      },
    },
  };
  const recent: CoachBook = {
    version: 1,
    year: 2,
    teams: metadata,
    coaches: {
      [coach]: {
        teamId: 0,
        opponents: {
          1: {
            ...emptyScouting(),
            games: 1,
            possessions: 60,
            counterResults: results,
          },
        },
      },
    },
  };
  const next = seedCoachScouting(
    [
      { year: 1, coachBook: older },
      { year: 2, coachBook: recent },
    ],
    teams,
    3,
  )[0].scoutingSeed!.opponents[1].scouting;
  expect(next.possessions).toBeCloseTo(300 * 0.72 * 0.72, 3);
  expect(next.counterResults!.counters["top-lock"]!.used.attacks).toBe(7.2);
});
