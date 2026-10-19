import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import {
  createMoveRuntime,
  beginMoveSegment,
  activateMove,
  neutralMoveEffects,
} from "./matchMoves";
import {
  mergeAbilityActivations,
  validateAbilityActivations,
} from "./abilities";
import { movePool } from "./basketballMoves";
function player(move: string = "quick-attack") {
  const team = {
    ...createLeague(performanceRun())[0],
    movesetVersion: 1 as const,
  };
  const id = team.roster.PG!;
  const runtime = createMoveRuntime(team, id)!;
  runtime.plan.moves = [movePool(25).find((m) => m.id === move)!];
  return {
    moves: runtime,
    energy: 100,
    box: {
      playerId: `0:${id}`,
      abilityActivations: { offense: 0, support: 0, defense: 0 },
    },
  };
}
it("uses actual time, spends energy once, respects cooldown and clears temporary effects", () => {
  const p = player();
  beginMoveSegment([p]);
  const event = activateMove(p, "drive", 10, { clock: 15 });
  expect(event?.move).toBe("quick-attack");
  expect(p.energy).toBe(95);
  expect(p.moves.effects.movement).toBeGreaterThan(1);
  expect(activateMove(p, "drive", 11, { clock: 15 })).toBeUndefined();
  beginMoveSegment([p]);
  expect(p.moves.effects).toEqual(neutralMoveEffects());
  expect(activateMove(p, "drive", 40, { clock: 15 })).toBeUndefined();
  expect(activateMove(p, "drive", 76, { clock: 15 })?.move).toBe(
    "quick-attack",
  );
});
it("declines irrelevant, rushed or unaffordable actions without minting usage", () => {
  const p = player();
  beginMoveSegment([p]);
  expect(activateMove(p, "pass", 0, { clock: 15 })).toBeUndefined();
  expect(activateMove(p, "drive", 0, { clock: 0.5 })).toBeUndefined();
  p.energy = 27;
  expect(activateMove(p, "drive", 0, { clock: 15 })).toBeUndefined();
  expect(p.box.abilityActivations).not.toHaveProperty("moves");
});
it("supports a receiver only for the current segment and caps actual recovery", () => {
  const p = player("helping-hand"),
    receiver = player();
  beginMoveSegment([p, receiver]);
  activateMove(p, "pass", 5, { clock: 10, receiver });
  expect(receiver.moves.effects.shot).toBeGreaterThan(0);
  beginMoveSegment([p, receiver]);
  expect(receiver.moves.effects.shot).toBe(0);
  const tired = player("recover");
  tired.energy = 49;
  activateMove(tired, "recover", 0, { clock: 10 });
  expect(tired.energy).toBe(58);
  expect(tired.box.abilityActivations).toHaveProperty(
    "moves.energyRecovered",
    9,
  );
});
it("merges and validates actual move counters without altering passive activation totals", () => {
  const p = player();
  beginMoveSegment([p]);
  activateMove(p, "drive", 0, { clock: 15 });
  const total = {};
  mergeAbilityActivations(total, p.box);
  mergeAbilityActivations(total, p.box);
  const parsed = validateAbilityActivations((total as any).abilityActivations);
  expect(parsed.moves?.uses["quick-attack"]).toBe(2);
  expect(parsed.moves?.energySpent).toBe(10);
  expect(parsed.offense).toBe(0);
  expect(() =>
    validateAbilityActivations({
      ...parsed,
      moves: { ...parsed.moves, uses: { hacked: 1 } },
    }),
  ).toThrow();
  expect(() =>
    validateAbilityActivations({
      ...parsed,
      moves: { ...parsed.moves, energySpent: -1 },
    }),
  ).toThrow();
});
