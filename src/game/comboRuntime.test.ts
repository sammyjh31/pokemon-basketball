import { expect, it } from "vitest";
import { beginMoveSegment } from "./matchMoves";
import {
  createComboRuntime,
  beginComboSegment,
  startCombo,
  noteComboPass,
  completeCombo,
  comboPlayWeights,
  reserveComboDrive,
} from "./matchCombos";
import { signaturePlayer, signatureTeam } from "./signatureTestUtils";
import { pairKey } from "./teammateChemistry";
import type { ComboId } from "./comboTypes";
function setup(id: ComboId = "pick-roll") {
  const team = signatureTeam(),
    runtime = createComboRuntime(team)!;
  const plan = runtime.plans.find((p) => p.id === id)!;
  runtime.plans = [plan];
  const a = signaturePlayer(team, plan.initiatorId),
    b = signaturePlayer(team, plan.partnerId);
  return {
    team,
    runtime,
    a,
    b,
    context: { clock: 12, active: [a, b], hadDrive: true },
  };
}
it("charges two active partners once and creates a shot only after the actual pass and correct finish", () => {
  const { runtime, a, b, context } = setup();
  const event = startCombo(runtime, "screen", a, b, 10, context);
  expect(event?.stage).toBe("setup");
  expect(event?.playerIds).toEqual([a.box.playerId, b.box.playerId]);
  expect(a.energy).toBeLessThan(100);
  expect(b.energy).toBeLessThan(100);
  expect(a.moves.used).toBe(true);
  expect(b.moves.used).toBe(true);
  expect(b.moves.effects.screen).toBeGreaterThan(1);
  expect(completeCombo(runtime, b, "rim", 11)).toBeUndefined();
  noteComboPass(runtime, b, a);
  expect(completeCombo(runtime, b, "rim", 12)).toBeUndefined();
  noteComboPass(runtime, a, b);
  expect(completeCombo(runtime, b, "three", 12)).toBeUndefined();
  const shot = completeCombo(runtime, b, "rim", 13);
  expect(shot?.stage).toBe("shot");
  expect(shot?.energySpent).toEqual([0, 0]);
  expect(b.moves.effects.shot).toBeGreaterThan(0);
  for (const p of [a, b])
    expect(p.box.abilityActivations).toHaveProperty("moves.combos", {
      attempts: { "pick-roll": 1 },
      shotsCreated: { "pick-roll": 1 },
    });
  expect(completeCombo(runtime, b, "rim", 14)).toBeUndefined();
});
it("rejects bench, wrong-team, same-player, fouled-out, tired and rushed pair setups", () => {
  for (const kind of ["bench", "team", "same", "fouls", "energy", "clock"]) {
    const { runtime, a, b, context } = setup();
    if (kind === "bench") context.active = [a];
    if (kind === "team") b.box.teamId = 99;
    if (kind === "fouls") b.box.fouls = 6;
    if (kind === "energy") b.energy = 35;
    if (kind === "clock") context.clock = 2.99;
    expect(
      startCombo(runtime, "screen", a, kind === "same" ? a : b, 10, context),
      kind,
    ).toBeUndefined();
    expect(a.box.abilityActivations).not.toHaveProperty("moves.combos");
    expect(a.energy).toBe(100);
  }
});
it("expires unfinished setups each segment but retains player cooldowns through bench time", () => {
  const { runtime, a, b, context } = setup();
  expect(startCombo(runtime, "screen", a, b, 10, context)).toBeDefined();
  beginComboSegment(runtime);
  beginMoveSegment([a, b]);
  noteComboPass(runtime, a, b);
  expect(completeCombo(runtime, b, "rim", 20)).toBeUndefined();
  expect(startCombo(runtime, "screen", a, b, 109, context)).toBeUndefined();
  expect(startCombo(runtime, "screen", a, b, 111, context)).toBeDefined();
  expect(a.box.abilityActivations).toHaveProperty(
    "moves.combos.attempts.pick-roll",
    2,
  );
});
it("requires a real drive for a kickout and respects perimeter finish zones", () => {
  const { runtime, a, b, context } = setup("drive-kick");
  expect(
    startCombo(runtime, "kickout", a, b, 10, { ...context, hadDrive: false }),
  ).toBeUndefined();
  expect(startCombo(runtime, "kickout", a, b, 10, context)?.id).toBe(
    "drive-kick",
  );
  noteComboPass(runtime, a, b);
  expect(completeCombo(runtime, b, "rim", 12)).toBeUndefined();
  expect(completeCombo(runtime, b, "three", 12)?.stage).toBe("shot");
});
it("mastery and earned pair familiarity strengthen execution and only ready pairs bias play selection", () => {
  const cold = setup(),
    warmTeam = {
      ...cold.team,
      abilityMastery: Object.fromEntries(
        Object.keys(cold.team.abilityMastery!).map((id) => [id, 800]),
      ),
      chemistryBonds: {
        [pairKey(cold.a.box.pokemonId, cold.b.box.pokemonId)]: 6000,
      },
    };
  const warmRuntime = createComboRuntime(warmTeam)!;
  warmRuntime.plans = warmRuntime.plans.filter(
    (p) =>
      p.id === "pick-roll" &&
      p.initiatorId === cold.a.box.pokemonId &&
      p.partnerId === cold.b.box.pokemonId,
  );
  expect(warmRuntime.plans).toHaveLength(1);
  const a = signaturePlayer(warmTeam, cold.a.box.pokemonId),
    b = signaturePlayer(warmTeam, cold.b.box.pokemonId);
  expect(
    comboPlayWeights(cold.runtime, [cold.a, cold.b], 0).pickRoll,
  ).toBeGreaterThan(0);
  expect(comboPlayWeights(cold.runtime, [cold.a], 0)).toEqual({});
  const first = startCombo(
    cold.runtime,
    "screen",
    cold.a,
    cold.b,
    10,
    cold.context,
  )!;
  const second = startCombo(warmRuntime, "screen", a, b, 10, {
    ...cold.context,
    active: [a, b],
  })!;
  expect(second.strength).toBeGreaterThan(first.strength);
  expect(comboPlayWeights(cold.runtime, [cold.a, cold.b], 20)).toEqual({});
});
it("does not create runtimes without v2, chemistry or abilities, or execute locked mastery pairs", () => {
  const t = signatureTeam();
  expect(createComboRuntime({ ...t, movesetVersion: 1 })).toBeUndefined();
  expect(
    createComboRuntime({ ...t, chemistryVersion: undefined }),
  ).toBeUndefined();
  expect(
    createComboRuntime({ ...t, engineRules: { abilities: false } }),
  ).toBeUndefined();
  const locked = createComboRuntime({ ...t, abilityMastery: {} })!;
  expect(locked.plans).toEqual([]);
});
it("does not promote an unexecutable plan or spend non-finite participant energy", () => {
  const weak = setup();
  weak.runtime.plans[0].fit = 0;
  expect(comboPlayWeights(weak.runtime, [weak.a, weak.b], 0)).toEqual({});
  for (const energy of [Infinity, NaN]) {
    const { runtime, a, b, context } = setup();
    b.energy = energy;
    expect(startCombo(runtime, "screen", a, b, 10, context)).toBeUndefined();
    expect(a.energy).toBe(100);
  }
});
it("uses the active five's chemistry for execution as well as the pair's earned familiarity", () => {
  const cold = setup(),
    warm = setup();
  const a = startCombo(cold.runtime, "screen", cold.a, cold.b, 10, {
    ...cold.context,
    chemistry: 20,
  })!;
  const b = startCombo(warm.runtime, "screen", warm.a, warm.b, 10, {
    ...warm.context,
    chemistry: 90,
  })!;
  expect(b.strength).toBeGreaterThan(a.strength);
});
it("reserves a drive-and-kick opportunity only for a ready partner and sufficient attack time", () => {
  const { runtime, a, b } = setup("drive-kick");
  expect(reserveComboDrive(runtime, a, [a, b], 0, 12)).toBe(true);
  expect(reserveComboDrive(runtime, a, [a], 0, 12)).toBe(false);
  expect(reserveComboDrive(runtime, a, [a, b], 0, 4)).toBe(false);
  b.energy = 35;
  expect(reserveComboDrive(runtime, a, [a, b], 0, 12)).toBe(false);
});
