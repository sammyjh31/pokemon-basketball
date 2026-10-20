import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { emptyScouting } from "./opponentScouting";
import {
  seedCoachScouting,
  parseCoachBook,
  parseScoutingSeed,
  initialSeasonScouting,
} from "./scoutingContinuity";
import type { CoachBook } from "./scoutingContinuityTypes";
const clubs = () => createLeague({ ...performanceRun(), movesetVersion: 3 });
function fixture() {
  const teams = clubs();
  const coachId = teams[0].coach!.id;
  const book: CoachBook = {
    version: 1,
    year: 1,
    teams: teams.map((t) => ({
      id: t.id,
      roster: Object.values(t.roster) as number[],
      ...(t.coach ? { coachId: t.coach.id } : {}),
    })),
    coaches: {
      [coachId]: {
        teamId: 0,
        opponents: {
          1: {
            ...emptyScouting(),
            games: 4,
            possessions: 100,
            pickRolls: 20,
            players: {
              [teams[1].roster.PG!]: {
                attempts: 20,
                points: 30,
                rimAttempts: 10,
                threeAttempts: 5,
              },
            },
            moveReads: {
              moves: { "quick-attack": 20 },
              combos: { "pick-roll": 10 },
            },
          },
        },
      },
    },
  };
  return { teams, book, history: [{ year: 1, coachBook: book }] };
}
it("retains observed scouting into the next year without changing source books or older unseeded teams", () => {
  const { teams, book, history } = fixture(),
    before = JSON.stringify({ teams, book });
  const next = seedCoachScouting(history, teams, 2);
  expect(
    next[0].scoutingSeed!.opponents[1].scouting.moveReads!.moves[
      "quick-attack"
    ],
  ).toBe(14.4);
  expect(
    initialSeasonScouting(next)["0:1"].players[teams[1].roster.PG!].attempts,
  ).toBe(14.4);
  expect(JSON.stringify({ teams, book })).toBe(before);
  expect(seedCoachScouting([], teams, 2)).toEqual(teams);
  expect(initialSeasonScouting(teams)).toEqual({});
});
it("tracks a known traded player but discounts team and pair reads after turnover and an opposing hire", () => {
  const { teams, history } = fixture();
  const traded = structuredClone(teams),
    known = traded[1].roster.PG!;
  [traded[1].roster.PG, traded[2].roster.PG] = [
    traded[2].roster.PG,
    traded[1].roster.PG,
  ];
  traded[1].coach = { version: 1, id: "mom" };
  const next = seedCoachScouting(history, traded, 2)[0].scoutingSeed!;
  expect(next.opponents[1].scouting.players[known]).toBeUndefined();
  expect(next.opponents[2].scouting.players[known].attempts).toBeGreaterThan(0);
  expect(
    next.opponents[1].scouting.moveReads!.moves["quick-attack"]!,
  ).toBeLessThan(14.4);
  expect(
    next.opponents[1].scouting.moveReads!.combos["pick-roll"]!,
  ).toBeLessThan(7.2);
  expect(next.opponents[1].retainedPlayers).toBe(7);
  expect(next.opponents[1].coachChanged).toBe(true);
  expect(next.opponents[2].scouting.games).toBe(0);
});
it("follows a coach's identity to a new club and gives a new hire weaker club reports", () => {
  const { teams, history } = fixture();
  const moved = structuredClone(teams);
  [moved[0].coach, moved[2].coach] = [moved[2].coach, moved[0].coach];
  const next = seedCoachScouting(history, moved, 2);
  expect(
    next[2].scoutingSeed!.opponents[1].scouting.moveReads!.moves[
      "quick-attack"
    ],
  ).toBe(14.4);
  expect(
    next[0].scoutingSeed!.opponents[1].scouting.moveReads!.moves[
      "quick-attack"
    ],
  ).toBeCloseTo(5.04);
  expect(next[0].scoutingSeed!.opponents[1].sourceCoachId).toBe(
    teams[0].coach!.id,
  );
  expect(
    seedCoachScouting(history, teams, 10)[0].scoutingSeed!.opponents,
  ).toEqual({});
});
it("strictly validates books/seeds and rejects fake knowledge or seed roster mismatches", () => {
  const { teams, book, history } = fixture();
  expect(
    parseCoachBook(
      book,
      1,
      teams.map((t) => Object.values(t.roster) as number[]),
    ),
  ).toEqual(book);
  expect(() =>
    parseCoachBook(
      { ...book, year: 2 },
      1,
      teams.map((t) => Object.values(t.roster) as number[]),
    ),
  ).toThrow();
  const next = seedCoachScouting(history, teams, 2);
  expect(parseScoutingSeed(next[0].scoutingSeed, 0, 30)).toEqual(
    next[0].scoutingSeed,
  );
  const bad = structuredClone(next);
  bad[1].roster.PG = 1025;
  expect(() => initialSeasonScouting(bad)).toThrow();
});
it("lets a coach recognize their former players even after changing jobs", () => {
  const { teams, book, history } = fixture();
  const known = teams[0].roster.PG!;
  book.coaches[teams[0].coach!.id].selfPlayers = {
    [known]: { attempts: 100, points: 150, rimAttempts: 10, threeAttempts: 30 },
  };
  const nextTeams = structuredClone(teams);
  [nextTeams[0].coach, nextTeams[2].coach] = [
    nextTeams[2].coach,
    nextTeams[0].coach,
  ];
  const next = seedCoachScouting(history, nextTeams, 2)[2].scoutingSeed!;
  expect(next.opponents[0].scouting.players[known].attempts).toBe(72);
  expect(next.opponents[0].scouting.games).toBe(0);
});
it("does not attribute ambiguous family signatures to a traded player or invent rookie reads", () => {
  const { teams, book, history } = fixture();
  const record = book.coaches[teams[0].coach!.id].opponents[1];
  // Pikachu's family signature is uniquely attributable only with one eligible family member.
  teams[1].roster.PG = 25;
  teams[1].roster.SG = 26;
  book.teams[1].roster = Object.values(teams[1].roster) as number[];
  record.players = {};
  record.moveReads = {
    moves: { "pikachu-volt-tackle": 20 },
    combos: {},
  };
  const changed = structuredClone(teams);
  [changed[1].roster.PG, changed[2].roster.PG] = [
    changed[2].roster.PG,
    changed[1].roster.PG,
  ];
  const next = seedCoachScouting(history, changed, 2)[0].scoutingSeed!;
  expect(next.opponents[2]).toBeUndefined();
  expect(next.opponents[1].scouting.players).toEqual({});
});

it("carries a uniquely attributable signature with a traded player who took no recorded shots", () => {
  const { teams, book, history } = fixture();
  teams[1].roster.PG = 25;
  book.teams[1].roster = Object.values(teams[1].roster) as number[];
  const record = book.coaches[teams[0].coach!.id].opponents[1];
  record.players = {};
  record.moveReads = { moves: { "pikachu-volt-tackle": 20 }, combos: {} };
  const changed = structuredClone(teams);
  [changed[1].roster.PG, changed[2].roster.PG] = [
    changed[2].roster.PG,
    changed[1].roster.PG,
  ];
  const next = seedCoachScouting(history, changed, 2)[0].scoutingSeed!;
  expect(
    next.opponents[2].scouting.moveReads!.moves["pikachu-volt-tackle"],
  ).toBe(10.08);
  expect(next.opponents[2].scouting.games).toBe(0);
  expect(next.opponents[2].scouting.players).toEqual({});
  expect(() => parseScoutingSeed(next, 0, 30)).not.toThrow();
});
