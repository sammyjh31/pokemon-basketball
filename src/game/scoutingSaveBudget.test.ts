import { COUNTER_KEYS, emptyCounterSample } from "./counterLearning";
import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { emptyScouting } from "./opponentScouting";
import { parseCoachBook, seedCoachScouting } from "./scoutingContinuity";
import type { CoachBook } from "./scoutingContinuityTypes";
import { MOVE_IDS } from "./moveTypes";
import { COMBO_IDS } from "./comboTypes";
import { LOCAL_SAVE_MAX_LENGTH } from "./localLeague";
import { needsBackgroundLocalRestore } from "./localLeagueRestore";
import { SaveStorage } from "./saveStorage";
it("budgets rich scouting books and opening seeds for a supported 50-year,30-club career", async () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 4 });
  const book: CoachBook = {
    version: 1,
    year: 1,
    teams: teams.map((t) => ({
      id: t.id,
      roster: Object.values(t.roster) as number[],
      coachId: t.coach!.id,
    })),
    coaches: {},
  };
  for (const team of teams) {
    const opponents: CoachBook["coaches"][string]["opponents"] = {};
    for (const other of teams)
      if (other.id !== team.id)
        opponents[other.id] = {
          ...emptyScouting(),
          counterResults: {
            version: 1,
            counters: Object.fromEntries(
              COUNTER_KEYS.map((id) => [
                id,
                {
                  used: {
                    ...emptyCounterSample(),
                    attacks: 99.123,
                    points: 99.123,
                    scoreless: 20.123,
                    turnovers: 10.123,
                    fouls: 5.123,
                    energy: 200.123,
                    answered: 10.123,
                  },
                  without: {
                    ...emptyCounterSample(),
                    attacks: 99.123,
                    points: 150.123,
                    scoreless: 20.123,
                    turnovers: 10.123,
                    fouls: 5.123,
                  },
                },
              ]),
            ),
          },
          games: 8,
          possessions: 1000.123,
          pickRolls: 200.123,
          switches: 100.123,
          helpRotations: 80.123,
          players: Object.fromEntries(
            Object.values(other.roster).map((id) => [
              id,
              {
                attempts: 120.123,
                points: 200.123,
                rimAttempts: 30.123,
                threeAttempts: 40.123,
              },
            ]),
          ),
          moveReads: {
            moves: Object.fromEntries(MOVE_IDS.map((id) => [id, 99.123])),
            combos: Object.fromEntries(COMBO_IDS.map((id) => [id, 99.123])),
          },
        };
    book.coaches[team.coach!.id] = { teamId: team.id, opponents };
  }
  expect(
    parseCoachBook(
      book,
      1,
      book.teams.map((t) => t.roster),
    ),
  ).toEqual(book);
  const next = seedCoachScouting([{ year: 1, coachBook: book }], teams, 2);
  const annual = JSON.stringify({ coachBook: book, teams: next }).length;
  // Conservative projection: every year retains all defined moves, even those
  // unlikely to coexist on one roster, plus the pre-scouting 10.8M baseline.
  const projected = 49 * annual + 10_800_000;
  expect(projected).toBeGreaterThan(16_000_000);
  expect(projected).toBeLessThan(LOCAL_SAVE_MAX_LENGTH);
  // Exercise the actual routing/storage path above the former parser ceiling.
  const raw = JSON.stringify({
    chemistryGrowthVersion: 1,
    career: { history: [] },
    padding: "x".repeat(17_000_000),
  });
  expect(needsBackgroundLocalRestore(raw)).toBe(true);
  const area = new Map<string, string>(),
    records = new Map<string, string>();
  const store = {
    readAll: async () => new Map(records),
    put: async (k: string, v: string) => {
      records.set(k, v);
    },
    delete: async (k: string) => {
      records.delete(k);
    },
  };
  const local = {
    getItem: (k: string) => area.get(k) ?? null,
    setItem: (k: string, v: string) => {
      area.set(k, v);
    },
    removeItem: (k: string) => {
      area.delete(k);
    },
  };
  const storage = new SaveStorage(() => local);
  await storage.attach(store);
  storage.setItem("career", raw);
  await storage.flush();
  const reopened = new SaveStorage(() => local);
  await reopened.attach(store);
  expect(reopened.getItem("career")).toBe(raw);
}, 30000);
