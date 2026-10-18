import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { advanceMastery, retainMastery } from "./abilityMastery";
import { masteryLevel } from "./masteryMath";
import { insightTeams } from "./insightAnalysis.testUtils";
import { timeoutDecision } from "./gameFlow";
import { isRollAttack, type CourtSequence } from "./courtTypes";

it("counts the screener receiving the ball, not the handler who used the screen", () => {
  const sequence = {
    coverage: "drop",
    outcome: "made",
    shooterId: "0:5",
    actions: [{ kind: "screen", playerId: "0:1", targetId: "0:5", clock: 18 }],
  } as CourtSequence;
  expect(isRollAttack(sequence)).toBe(true);
  expect(isRollAttack({ ...sequence, shooterId: "0:1" })).toBe(false);
  expect(isRollAttack({ ...sequence, outcome: "turnover" })).toBe(false);
  expect(isRollAttack({ ...sequence, outcome: "violation" })).toBe(false);
});

const clubs = () =>
  createLeague({
    ...createRun("free", true, 22),
    courtVersion: 3,
    coach: { version: 1, id: "clair" },
    roster: {
      PG: 135,
      SG: 150,
      SF: 94,
      PF: 149,
      C: 245,
      B1: 62,
      B2: 199,
      B3: 200,
    },
  });

it("keeps completed version-3 games byte-identical when new rules are introduced", () => {
  const teams = clubs();
  const hash = createHash("sha256");
  for (let seed = 1; seed <= 4; seed++)
    hash.update(
      JSON.stringify(simulateMatch(teams[0], teams[seed], seed * 19)),
    );
  expect(hash.digest("hex")).toBe(
    "0083964cbaaa358c8b90a31c4d44d82ba921775c4c4bda2843aeea3cb54e9ba2",
  );
});

it("counts screened finisher attacks from real court sequences in the new rules", () => {
  const teams = clubs().map((t) => ({ ...t, courtVersion: 4 as const }));
  let rolls = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const match = simulateMatch(teams[0], teams[seed], seed * 19);
    for (const timeout of match.gameFlow!.timeouts) {
      const start =
        Math.min(timeout.period - 1, 4) * 720 +
        Math.max(0, timeout.period - 5) * 300;
      const remaining =
        (timeout.period <= 4 ? 720 : 300) - (timeout.elapsedSeconds - start);
      expect(remaining).toBeGreaterThan(0);
      if (timeout.reason !== "late") expect(remaining).toBeGreaterThan(24);
    }
    for (const [side, id] of [
      ["home", 0],
      ["away", seed],
    ] as const) {
      const expected = match.insights!.court!.filter(
        (s) =>
          s.offenseTeamId === id &&
          s.outcome !== "turnover" &&
          s.outcome !== "violation" &&
          s.actions.some(
            (a) => a.kind === "screen" && a.targetId === s.shooterId,
          ),
      ).length;
      expect(match.typeTactics![side].rolls).toBe(expected);
      rolls += expected;
    }
  }
  expect(rolls).toBeGreaterThan(0);
});

it("earns season milestones for stars and rotation players while preserving legacy XP", () => {
  const original = retainMastery({
    ...insightTeams[0],
    abilityVersion: 1 as const,
  });
  const boxes = Object.values(original.roster).map((pokemonId, i) => ({
    pokemonId: pokemonId!,
    minutes: i < 5 ? 36 : 20,
    abilityActivations: {
      offense: i < 5 ? 12 : 3,
      support: 0,
      defense: i < 5 ? 4 : 0,
    },
  }));
  const legacy = { ...original, courtVersion: 3 as const };
  let current = { ...original, courtVersion: 4 as const };
  expect(advanceMastery(legacy, boxes)[1]).toBe(0.69);
  for (let game = 0; game < 82; game++)
    current = { ...current, abilityMastery: advanceMastery(current, boxes) };
  expect(masteryLevel(current.abilityMastery[1]).name).toBe("Skilled");
  expect(masteryLevel(current.abilityMastery[6]).name).toBe("Practiced");
  expect(current.abilityMastery[1]).toBeLessThan(400);
  expect(
    advanceMastery(
      current,
      boxes.map((b) => ({ ...b, minutes: 0 })),
    ),
  ).toEqual(current.abilityMastery);
  expect(
    advanceMastery({ ...current, engineRules: { abilities: false } }, boxes),
  ).toEqual(current.abilityMastery);
  const overtime = boxes.map((b) => ({
    ...b,
    minutes: (b.minutes * 53) / 48,
  }));
  // Normalize identical minute workloads, with no ability events, in a longer game.
  const noUses = boxes.map((b) => ({ ...b, abilityActivations: undefined }));
  expect(
    advanceMastery(
      current,
      overtime.map((b) => ({ ...b, abilityActivations: undefined })),
      1,
    ),
  ).toEqual(advanceMastery(current, noUses));
  const capped = {
    ...current,
    abilityMastery: Object.fromEntries(
      Object.keys(current.abilityMastery).map((id) => [id, 999.99]),
    ),
  };
  expect(Object.values(advanceMastery(capped, boxes))).toEqual(
    Array(8).fill(1000),
  );
});

it("saves run and rest timeouts near period breaks but retains late-game plays", () => {
  const coach = { adaptability: 0.5, rest: 0.5 };
  const state = {
    period: 1,
    remaining: 0.2,
    untilWindow: 30,
    margin: -2,
    run: 12,
    energy: 40,
    left: 6,
    fourthUsed: 0,
    restUsedThisPeriod: false,
    lateUsedThisPeriod: false,
  };
  expect(timeoutDecision(coach, state)).toBe("run");
  expect(timeoutDecision(coach, state, true)).toBeUndefined();
  expect(
    timeoutDecision(coach, { ...state, remaining: 10 }, true),
  ).toBeUndefined();
  expect(timeoutDecision(coach, { ...state, remaining: 30 }, true)).toBe("run");
  expect(
    timeoutDecision(coach, { ...state, period: 3, remaining: 3 }, true),
  ).toBe("late");
  expect(
    timeoutDecision(coach, { ...state, period: 3, remaining: 0 }, true),
  ).toBeUndefined();
});
