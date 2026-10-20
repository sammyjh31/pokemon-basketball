import { expect, it } from "vitest";
import {
  counterDecision,
  emptyCounterResults,
  updateCounterResults,
  validateCounterResults,
} from "./counterLearning";
const sample = (attacks: number, points: number, energy = 0) => ({
  attacks,
  points,
  scoreless: attacks - Math.min(attacks, points / 2),
  turnovers: 0,
  fouls: 0,
  energy,
  answered: 0,
});
it("prefers efficient opponent-specific counters and scales back costly failures, with small-sample protection", () => {
  const good = emptyCounterResults();
  good.counters["contain-burst"] = {
    used: sample(40, 20, 100),
    without: sample(40, 60),
  };
  const bad = emptyCounterResults();
  bad.counters["contain-burst"] = {
    used: sample(40, 70, 100),
    without: sample(40, 30),
  };
  expect(counterDecision(good, "contain-burst").emphasis).toBe("emphasize");
  expect(counterDecision(bad, "contain-burst").emphasis).toBe("reduce");
  const tiny = emptyCounterResults();
  tiny.counters["contain-burst"] = {
    used: sample(1, 0, 2.5),
    without: sample(1, 3),
  };
  expect(counterDecision(tiny, "contain-burst").emphasis).toBe("explore");
  expect(counterDecision(emptyCounterResults(), "contain-burst").emphasis).toBe(
    "explore",
  );
});
it("reverses the outcome objective for offensive counter-combos and discounts old meetings without mutating them", () => {
  const old = emptyCounterResults();
  old.counters["slip-and-seal"] = {
    used: sample(40, 60, 280),
    without: sample(40, 20),
  };
  expect(counterDecision(old, "slip-and-seal").emphasis).toBe("emphasize");
  const saved = JSON.stringify(old);
  const next = updateCounterResults(old, emptyCounterResults(), 0.5);
  expect(next.counters["slip-and-seal"]!.used.attacks).toBe(20);
  expect(JSON.stringify(old)).toBe(saved);
  expect(validateCounterResults(next)).toEqual(next);
});
it("rejects forged outcome counters, malformed samples and impossible totals", () => {
  const value = emptyCounterResults();
  value.counters["top-lock"] = {
    used: sample(10, 10, 25),
    without: sample(5, 5),
  };
  for (const wrong of [
    { ...value, version: 2 },
    { ...value, counters: { fake: value.counters["top-lock"] } },
    {
      ...value,
      counters: {
        "top-lock": {
          used: { ...sample(1, 0), scoreless: 2 },
          without: sample(0, 0),
        },
      },
    },
  ])
    expect(() => validateCounterResults(wrong)).toThrow();
  expect(validateCounterResults(value)).toEqual(value);
});
it("changes real counter timing rather than granting a free outcome bonus", async () => {
  const { createCounterRuntime, counterMove, beginCounterSegment } =
    await import("./moveCounters");
  const { signatureTeam, signaturePlayer } =
    await import("./signatureTestUtils");
  const team = { ...signatureTeam(), movesetVersion: 4 as const, id: 1 };
  const attackTeam = { ...team, id: 0 };
  function uses(points: number) {
    const results = emptyCounterResults();
    results.counters["contain-burst"] = {
      used: sample(40, points, 100),
      without: sample(40, 40),
    };
    const runtime = createCounterRuntime(
      team,
      { moves: { "quick-attack": 50 }, combos: {} },
      results,
    )!;
    const a = signaturePlayer(attackTeam, 25),
      d = signaturePlayer(team, 65);
    let count = 0;
    for (let i = 1; i <= 24; i++) {
      beginCounterSegment(runtime);
      a.moves.effects.movement = 1.2;
      d.energy = 100;
      if (
        counterMove(
          runtime,
          a,
          d,
          {
            playerId: a.box.playerId,
            move: "quick-attack",
            opportunity: "drive",
            specialization: "control",
            elapsedSeconds: i * 100,
            energySpent: 5,
            energyRecovered: 0,
          },
          i * 100,
          [d],
        )
      )
        count++;
    }
    return count;
  }
  expect(uses(10)).toBeGreaterThan(uses(100));
});
