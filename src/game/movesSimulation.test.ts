import { expect, it } from "vitest";
import { createHash } from "node:crypto";
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
it("freezes moveset-v1 game results and telemetry for future saved replays", () => {
  const teams = clubs();
  const outputs = [5, 42, 81].map((seed) => {
    const m = simulateMatch(teams[0], teams[1], seed);
    return {
      homeScore: m.homeScore,
      awayScore: m.awayScore,
      homeBox: m.homeBox,
      awayBox: m.awayBox,
      court: m.insights!.court,
      mastery: m.masteryReport,
    };
  });
  expect(
    createHash("sha256").update(JSON.stringify(outputs)).digest("hex"),
  ).toBe("c6589932730d159e4a0386c114a7ebb39abbba75b7b2a97359f87882578db93a");
});
it("does not spend a shooting or contest move on a shot-clock violation", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 1 });
  const match = simulateMatch(teams[0], teams[1], 5);
  const violations = match.insights!.court!.filter(
    (s) => s.outcome === "violation",
  );
  expect(violations.length).toBeGreaterThan(0);
  for (const sequence of violations) {
    expect(sequence.actions.some((a) => a.kind === "shoot")).toBe(false);
    expect(
      (sequence.moves ?? []).filter((e) =>
        ["shoot", "defend"].includes(e.opportunity),
      ),
    ).toEqual([]);
  }
});
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
  for (const sequence of m.insights!.court!) {
    const events = sequence.moves ?? [];
    expect(new Set(events.map((e) => e.playerId)).size).toBe(events.length);
    expect(
      events.every((e) =>
        sequence.positions.some((p) => p.playerId === e.playerId),
      ),
    ).toBe(true);
  }
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
