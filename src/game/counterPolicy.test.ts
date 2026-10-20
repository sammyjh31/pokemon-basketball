import { expect, it } from "vitest";
import { signatureTeam, signaturePlayer } from "./signatureTestUtils";
import {
  createCounterRuntime,
  beginCounterSegment,
  counterMove,
  counterCombo,
  counterPlans,
} from "./moveCounters";
import { createComboRuntime, startCombo } from "./matchCombos";
import type { MoveEvent } from "./moveTypes";

const club = (id: number) => ({
  ...signatureTeam(),
  id,
  movesetVersion: 3 as const,
  coach: { version: 1 as const, id: "misty" },
});
const burst: MoveEvent = {
  playerId: "0:25",
  move: "quick-attack",
  opportunity: "drive",
  specialization: "control",
  elapsedSeconds: 10,
  energySpent: 5,
  energyRecovered: 0,
};
function fixture() {
  const offense = club(0),
    defense = club(1);
  const a = signaturePlayer(offense, 25),
    d = signaturePlayer(defense, 65);
  const runtime = createCounterRuntime(defense)!;
  return { offense, defense, a, d, runtime };
}
it("learns only observed repeats, pays energy and respects cooldowns and active defenders", () => {
  const { a, d, runtime } = fixture();
  expect(counterPlans(runtime.reads)).toEqual([]);
  for (let i = 0; i < 2; i++) {
    a.moves.effects.movement = 1.2;
    expect(counterMove(runtime, a, d, burst, i * 10, [d])).toBeUndefined();
    expect(a.moves.effects.movement).toBe(1.2);
  }
  a.moves.effects.drive = 0.1;
  const before = d.energy;
  const event = counterMove(runtime, a, d, burst, 20, [d]);
  expect(event?.id).toBe("contain-burst");
  expect(a.moves.effects.movement).toBeLessThan(1.2);
  expect(a.moves.effects.movement).toBeGreaterThanOrEqual(1);
  expect(a.moves.effects.drive).toBeLessThan(0.1);
  expect(d.energy).toBeLessThan(before);
  expect(event!.energySpent[0]).toBeCloseTo(before - d.energy, 6);
  beginCounterSegment(runtime);
  a.moves.effects.movement = 1.2;
  expect(counterMove(runtime, a, d, burst, 21, [d])).toBeUndefined();
  beginCounterSegment(runtime);
  expect(counterMove(runtime, a, d, burst, 200, [])).toBeUndefined();
  expect(runtime.reads.moves["quick-attack"]).toBe(5);
});
it("owns its prior memory, considers mastery/coach skill, and disables adaptive reads when requested", () => {
  const { a, d, defense } = fixture();
  const source = { moves: { "quick-attack": 12 }, combos: {} };
  const runtime = createCounterRuntime(defense, source)!;
  a.moves.effects.movement = 1.25;
  expect(
    counterMove(runtime, a, d, burst, 10, [d])?.confidence,
  ).toBeGreaterThan(0.5);
  expect(source.moves["quick-attack"]).toBe(12);
  expect(
    createCounterRuntime({ ...defense, movesetVersion: 2 }),
  ).toBeUndefined();
  expect(
    createCounterRuntime({ ...defense, engineRules: { abilities: false } }),
  ).toBeUndefined();
  expect(
    createCounterRuntime({
      ...defense,
      engineRules: { abilities: true, adaptiveCoaching: false },
    }),
  ).toBeUndefined();
});
it("coordinates a paid combo counter and one mastered offensive counter-combo, never using a bench player", () => {
  const { offense, defense } = fixture();
  const combo = createComboRuntime(offense)!;
  const plan = combo.plans.find((p) => p.id === "pick-roll")!;
  const a = signaturePlayer(offense, plan.initiatorId),
    b = signaturePlayer(offense, plan.partnerId);
  const d = signaturePlayer(defense, 65),
    e = signaturePlayer(defense, 143);
  const start = startCombo(combo, "screen", a, b, 30, {
    clock: 20,
    active: [a, b],
    chemistry: 90,
  })!;
  expect(start).toBeDefined();
  const def = createCounterRuntime(defense, {
    moves: {},
    combos: { "pick-roll": 12 },
  })!;
  const off = createCounterRuntime(offense)!;
  const context = {
    now: 30,
    offense: [a, b],
    defense: [d, e],
    guards: new Map([
      [a, d],
      [b, e],
    ]),
    offenseChemistry: 90,
    defenseChemistry: 90,
  };
  const before = [a.energy, b.energy, d.energy, e.energy];
  const events = counterCombo(def, off, combo, start, context);
  expect(events.map((e) => e.id)).toEqual(["switch-deny", "slip-and-seal"]);
  expect(events[0].playerIds).toEqual([d.box.playerId, e.box.playerId]);
  expect(events[1].playerIds).toEqual([a.box.playerId, b.box.playerId]);
  expect(
    [a.energy, b.energy, d.energy, e.energy].every((n, i) => n < before[i]),
  ).toBe(true);
  expect(events.every((e) => e.energySpent.every((n) => n > 0))).toBe(true);
  expect(counterCombo(def, off, combo, start, context)).toEqual([]);
});
it.each(["bench", "fouled-out", "exhausted"])(
  "cannot counter with a %s defender",
  (condition) => {
    const { a, d, defense } = fixture();
    const runtime = createCounterRuntime(defense, {
      moves: { "quick-attack": 20 },
      combos: {},
    })!;
    a.moves.effects.movement = 1.25;
    if (condition === "fouled-out") d.box.fouls = 6;
    if (condition === "exhausted") d.energy = 30;
    const energy = d.energy;
    expect(
      counterMove(runtime, a, d, burst, 10, condition === "bench" ? [] : [d]),
    ).toBeUndefined();
    expect(a.moves.effects.movement).toBe(1.25);
    expect(d.energy).toBe(energy);
  },
);
