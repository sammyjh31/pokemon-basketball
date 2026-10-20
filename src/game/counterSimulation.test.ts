import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { simulateMatch } from "./match";
import {
  recordScouting,
  scoutingForMatch,
  validateMatchScouting,
} from "./opponentScouting";
import {
  validateMoveStats,
  sameMoveStats,
  mergeMoveStats,
  emptyMoveStats,
} from "./moveTelemetry";
import type { ScoutingMemory } from "./typeTacticsTypes";

function clubs() {
  return createLeague({ ...performanceRun(), movesetVersion: 3 }).map(
    (team) => ({
      ...team,
      abilityMastery: Object.fromEntries(
        Object.values(team.roster).map((id) => [id, 400]),
      ),
    }),
  );
}
it("executes real counters for both teams, reconciles events and energy, and learns completed games without insight collection", () => {
  const teams = clubs(),
    source = JSON.stringify(teams),
    memory: ScoutingMemory = {};
  const context = scoutingForMatch(memory, 0, 1);
  const first = simulateMatch(teams[0], teams[1], 1982, { scouting: context });
  const events = first.insights!.court!.flatMap((s) => s.counters ?? []);
  expect(events.length).toBeGreaterThan(0);
  for (const side of [first.homeBox, first.awayBox])
    expect(side.some((p) => p.abilityActivations?.moves?.counters)).toBe(true);
  for (const box of [...first.homeBox, ...first.awayBox]) {
    const own = events.filter((e) => e.playerIds.includes(box.playerId));
    const recorded = box.abilityActivations?.moves?.counters;
    const sequences = first.insights!.court!;
    const energy =
      sequences
        .flatMap((s) => s.moves ?? [])
        .filter((e) => e.playerId === box.playerId)
        .reduce((n, e) => n + e.energySpent, 0) +
      sequences
        .flatMap((s) => s.combos ?? [])
        .filter((e) => e.playerIds.includes(box.playerId))
        .reduce(
          (n, e) => n + e.energySpent[e.playerIds.indexOf(box.playerId)],
          0,
        ) +
      own.reduce(
        (n, e) => n + e.energySpent[e.playerIds.indexOf(box.playerId)],
        0,
      );
    expect(box.abilityActivations?.moves?.energySpent ?? 0).toBeCloseTo(
      energy,
      5,
    );
    expect(
      Object.values(recorded?.responses ?? {}).reduce((a, b) => a + b, 0) +
        Object.values(recorded?.counterCombos ?? {}).reduce((a, b) => a + b, 0),
    ).toBe(own.length);
    if (box.abilityActivations?.moves)
      expect(validateMoveStats(box.abilityActivations.moves)).toEqual(
        box.abilityActivations.moves,
      );
  }
  const compact = simulateMatch(teams[0], teams[1], 1982, {
    scouting: context,
    collectInsights: false,
  });
  expect({ ...first, insights: undefined }).toEqual(compact);
  recordScouting(memory, teams[0], teams[1], compact);
  expect(Object.keys(memory["0:1"].moveReads!.moves).length).toBeGreaterThan(0);
  expect(context.home).not.toHaveProperty("moveReads");
  const next = scoutingForMatch(memory, 0, 1),
    saved = JSON.stringify(next);
  expect(validateMatchScouting(next, teams[0], teams[1])).toEqual(next);
  const second = simulateMatch(teams[0], teams[1], 1982, { scouting: next });
  expect(second.counterPlans!.home.length).toBeGreaterThan(0);
  expect(JSON.stringify(next)).toBe(saved);
  expect(JSON.stringify(teams)).toBe(source);
});
it("validates and aggregates optional counter telemetry without treating it as a made shot or a stop", () => {
  const stats = {
    uses: {},
    energySpent: 6,
    energyRecovered: 0,
    counters: {
      responses: { "switch-deny": 2 },
      counterCombos: { "slip-and-seal": 1 },
    },
  };
  expect(validateMoveStats(stats)).toEqual(stats);
  const total = emptyMoveStats();
  mergeMoveStats(total, stats);
  mergeMoveStats(total, stats);
  expect(total.counters!.responses["switch-deny"]).toBe(4);
  expect(total.counters!.counterCombos["slip-and-seal"]).toBe(2);
  expect(sameMoveStats(total, stats)).toBe(false);
  expect(() =>
    validateMoveStats({
      ...stats,
      counters: { responses: { unknown: 2 }, counterCombos: {} },
    }),
  ).toThrow();
  expect(() =>
    validateMoveStats({
      ...stats,
      counters: { responses: { "switch-deny": -0.5 }, counterCombos: {} },
    }),
  ).toThrow();
});
it("rejects forged scouting and leaves older games and disabled coaching without counter observations", () => {
  const teams = clubs();
  const context = scoutingForMatch({}, 0, 1);
  context.home.moveReads = { moves: { "quick-attack": 10 }, combos: {} };
  expect(() => validateMatchScouting(context, teams[0], teams[1])).toThrow(); // no completed meeting
  context.home.games = 1;
  expect(() =>
    validateMatchScouting(
      {
        ...context,
        home: {
          ...context.home,
          moveReads: { moves: { forged: 2 }, combos: {} },
        },
      },
      teams[0],
      teams[1],
    ),
  ).toThrow();
  for (const enabled of [false, true]) {
    const off = teams
      .slice(0, 2)
      .map((t) => ({
        ...t,
        engineRules: {
          version: 1 as const,
          abilities: enabled,
          adaptiveCoaching: false,
          familiarity: 0,
        },
      }));
    const match = simulateMatch(off[0], off[1], 81);
    expect(match.counterPlans).toBeUndefined();
    expect(match.insights!.court!.every((s) => !s.counters)).toBe(true);
    expect(
      [...match.homeBox, ...match.awayBox].every(
        (b) => !b.abilityActivations?.moves?.counters,
      ),
    ).toBe(true);
  }
});
