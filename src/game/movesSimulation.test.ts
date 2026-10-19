import { expect, it } from "vitest";
import { performanceRun } from "./seasonPerformance.testUtils";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import {
  createMoveRuntime,
  beginMoveSegment,
  activateMove,
} from "./matchMoves";
import { moveToward } from "./courtPossession";
import type { Player } from "./matchLineups";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
function clubs() {
  return createLeague(performanceRun()).map((t) => ({
    ...t,
    movesetVersion: 1 as const,
    abilityMastery: Object.fromEntries(
      Object.values(t.roster).map((id) => [id!, 400]),
    ),
  }));
}
it("changes actual court travel only while a move is active", () => {
  const t = clubs()[0],
    p = {
      moves: createMoveRuntime(t, 25),
      energy: 100,
      profile: playerProfile(POKEMON_BY_ID.get(25)!),
      box: { playerId: "0:25", pokemonId: 25 },
    } as Player;
  p.moves!.plan.moves = p.moves!.plan.moves.filter(
    (m) => m.id === "quick-attack",
  );
  if (!p.moves!.plan.moves.length) throw Error("fixture needs quick attack");
  beginMoveSegment([p]);
  const ordinary = moveToward({ x: 0, y: 0 }, { x: 24, y: 20 }, p, 0.5);
  activateMove(p, "drive", 0, { clock: 15 });
  const boosted = moveToward({ x: 0, y: 0 }, { x: 24, y: 20 }, p, 0.5);
  expect(Math.hypot(boosted.x, boosted.y)).toBeGreaterThan(
    Math.hypot(ordinary.x, ordinary.y),
  );
});
it("uses coached moves in CPU match resolution with exact repeatability, accounting and compact parity", () => {
  const teams = clubs(),
    h = teams[0],
    a = teams[1],
    source = JSON.stringify([h, a]);
  const m = simulateMatch(h, a, 81),
    again = simulateMatch(h, a, 81);
  expect(m).toEqual(again);
  expect(JSON.stringify([h, a])).toBe(source);
  const boxes = [...m.homeBox, ...m.awayBox];
  expect(boxes.every((b) => b.abilityActivations?.moves !== undefined)).toBe(
    true,
  );
  expect(
    boxes.reduce(
      (n, b) =>
        n +
        Object.values(b.abilityActivations!.moves!.uses).reduce(
          (s, v) => s + v!,
          0,
        ),
      0,
    ),
  ).toBeGreaterThan(20);
  expect(
    m.insights!.court!.flatMap((s) => s.moves ?? []).length,
  ).toBeGreaterThan(20);
  expect({ ...m, insights: undefined }).toEqual(
    simulateMatch(h, a, 81, { collectInsights: false }),
  );
  expect(m.homeBox.reduce((n, b) => n + b.points, 0)).toBe(m.homeScore);
  expect(m.awayBox.reduce((n, b) => n + b.points, 0)).toBe(m.awayScore);
  const old = simulateMatch(
    { ...h, movesetVersion: undefined },
    { ...a, movesetVersion: undefined },
    81,
  );
  expect(
    old.homeBox.every((b) => b.abilityActivations?.moves === undefined),
  ).toBe(true);
  expect(m.homeBox).not.toEqual(old.homeBox);
  const disabled = simulateMatch(
    {
      ...h,
      engineRules: {
        version: 1,
        abilities: false,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    },
    {
      ...a,
      engineRules: {
        version: 1,
        abilities: false,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    },
    81,
  );
  expect(disabled.homeBox.every((b) => !b.abilityActivations?.moves)).toBe(
    true,
  );
});
