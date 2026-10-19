import { expect, it } from "vitest";
import {
  activateMove,
  beginMoveSegment,
  neutralMoveEffects,
} from "./matchMoves";
import { signatureMoves } from "./signatureMoves";
import { signaturePlayer, signatureTeam } from "./signatureTestUtils";
function mover(id: number, moveId: string) {
  const team = signatureTeam(),
    p = signaturePlayer(team, id);
  p.moves.plan.moves = [signatureMoves.find((m) => m.id === moveId)!];
  return p;
}
it("applies species and type effects to actual movement, screens, contests and shots with real energy", () => {
  const driver = mover(25, "pikachu-volt-tackle");
  const event = activateMove(driver, "drive", 10, { clock: 12 });
  expect(event?.move).toBe("pikachu-volt-tackle");
  expect(driver.moves.effects.movement).toBeGreaterThan(1);
  expect(driver.moves.effects.drive).toBeGreaterThan(0);
  expect(driver.energy).toBeLessThan(100);
  const screen = mover(3, "venusaur-vine-screen");
  activateMove(screen, "screen", 10, { clock: 12 });
  expect(screen.moves.effects.screen).toBeGreaterThan(1);
  const guard = mover(212, "type-steel");
  activateMove(guard, "defend", 10, { clock: 12, zone: "rim" });
  expect(guard.moves.effects.contest).toBeGreaterThan(0);
  const shot = mover(6, "charizard-skyhook");
  expect(
    activateMove(shot, "shoot", 10, { clock: 12, zone: "three" }),
  ).toBeUndefined();
  expect(
    activateMove(shot, "shoot", 10, { clock: 12, zone: "mid" })?.move,
  ).toBe("charizard-skyhook");
  expect(shot.moves.effects.shot).toBeGreaterThan(0);
  expect(shot.moves.effects.shot).toBeLessThanOrEqual(0.18);
  beginMoveSegment([driver, screen, guard, shot]);
  expect(driver.moves.effects).toEqual(neutralMoveEffects());
});
it("requires an actual eligible receiver for passing signatures and expires the benefit", () => {
  const passer = mover(65, "alakazam-psychic-relay"),
    receiver = mover(25, "type-electric");
  expect(activateMove(passer, "pass", 10, { clock: 12 })).toBeUndefined();
  expect(
    activateMove(passer, "pass", 10, { clock: 12, receiver: passer }),
  ).toBeUndefined();
  expect(activateMove(passer, "pass", 10, { clock: 12, receiver })?.move).toBe(
    "alakazam-psychic-relay",
  );
  expect(passer.moves.effects.passing).toBeGreaterThan(1);
  expect(receiver.moves.effects.shot).toBeGreaterThan(0);
  beginMoveSegment([passer, receiver]);
  expect(receiver.moves.effects.shot).toBe(0);
});
it("never activates a locked, legacy, unaffordable or too-late signature", () => {
  const low = mover(25, "pikachu-volt-tackle");
  low.moves.plan.xp = 99;
  expect(activateMove(low, "drive", 0, { clock: 12 })).toBeUndefined();
  const old = signaturePlayer({ ...signatureTeam(), movesetVersion: 1 }, 25);
  old.moves.plan.moves = [
    signatureMoves.find((m) => m.id === "pikachu-volt-tackle")!,
  ];
  expect(activateMove(old, "drive", 0, { clock: 12 })).toBeUndefined();
  const tired = mover(25, "pikachu-volt-tackle");
  tired.energy = 30;
  expect(activateMove(tired, "drive", 0, { clock: 12 })).toBeUndefined();
  const late = mover(25, "pikachu-volt-tackle");
  expect(activateMove(late, "drive", 0, { clock: 0.4 })).toBeUndefined();
  expect(late.box.abilityActivations).not.toHaveProperty("moves");
});
