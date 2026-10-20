import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { simulateMatch } from "./match";
import {
  recordScouting,
  scoutingForMatch,
  validateMatchScouting,
} from "./opponentScouting";
import { COUNTER_KEYS, counterDecision } from "./counterLearning";
import { COUNTER_IDS } from "./counterTypes";
import type { ScoutingMemory } from "./typeTacticsTypes";
it("learns actual completed attacks, keeps compact simulation identical, and plans from prior opponent results", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 4 }).map(
    (t) => ({
      ...t,
      abilityMastery: Object.fromEntries(
        Object.values(t.roster).map((id) => [id, 400]),
      ),
    }),
  );
  const memory: ScoutingMemory = {},
    context = scoutingForMatch(memory, 0, 1);
  const game = simulateMatch(teams[0], teams[1], 1982, { scouting: context });
  expect(game.counterResults).toBeDefined();
  expect({ ...game, insights: undefined }).toEqual(
    simulateMatch(teams[0], teams[1], 1982, {
      scouting: context,
      collectInsights: false,
    }),
  );
  for (const [side, team] of [
    ["home", teams[0]],
    ["away", teams[1]],
  ] as const) {
    const result = game.counterResults![side]!;
    for (const id of COUNTER_KEYS) {
      const observed = game.insights!.court!.filter((s) =>
        (s.counters ?? []).some(
          (e) => e.id === id && e.playerIds[0].startsWith(`${team.id}:`),
        ),
      );
      const row = result.counters[id];
      expect(row?.used.attacks ?? 0).toBe(observed.length);
      expect(row?.used.points ?? 0).toBe(
        observed.reduce((n, s) => n + s.points, 0),
      );
      expect(row?.used.energy ?? 0).toBeCloseTo(
        observed.reduce(
          (n, s) =>
            n +
            s
              .counters!.filter((e) => e.id === id)
              .reduce(
                (n, e) => n + e.energySpent.reduce((a, b) => a + b, 0),
                0,
              ),
          0,
        ),
        5,
      );
    }
    expect(
      Object.values(result.counters).some((row) => row!.without.attacks > 0),
    ).toBe(true);
  }
  recordScouting(memory, teams[0], teams[1], game);
  expect(memory["0:1"].counterResults).toEqual(game.counterResults!.home);
  const next = scoutingForMatch(memory, 0, 1);
  expect(validateMatchScouting(next, teams[0], teams[1])).toEqual(next);
  const saved = JSON.stringify(next),
    second = simulateMatch(teams[0], teams[1], 1983, { scouting: next });
  for (const plan of second.counterPlans!.home)
    expect(plan.learning).toEqual(
      counterDecision(next.home.counterResults, plan.id),
    );
  expect(JSON.stringify(next)).toBe(saved);
  expect(
    COUNTER_IDS.some(
      (id) => (game.counterResults!.home!.counters[id]?.used.attacks ?? 0) > 0,
    ),
  ).toBe(true);
}, 30000);
