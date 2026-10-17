import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { bodyProfile } from "./bodyMatchups";
import {
  moveToward,
  createCourt,
  applyScreenCoverage,
} from "./courtPossession";
import { resolveRebound } from "./possessionModel";
import type { Player } from "./matchLineups";
const actor = (pokemonId: number, id: number): Player => ({
  profile: structuredClone(playerProfile(POKEMON_BY_ID.get(25)!)),
  body: bodyProfile(POKEMON_BY_ID.get(25)!),
  energy: 80,
  physicalAbilities: true,
  types: ["normal"],
  typeEdges: new Map(),
  target: 30,
  consecutive: 0,
  box: {
    playerId: String(id),
    pokemonId,
    teamId: id < 5 ? 0 : 1,
  } as Player["box"],
});
it("movement changes actual court travel and records only additional distance before arrival", () => {
  const player = actor(92, 0),
    old = { ...player, physicalAbilities: undefined, box: { ...player.box } };
  const from = { x: 0, y: 0 },
    to = { x: 20, y: 0 };
  const a = moveToward(from, to, player, 0.5),
    b = moveToward(from, to, old, 0.5);
  expect(a.x).toBeGreaterThan(b.x);
  expect(player.box.abilityActivations!.physical!.movement).toBeCloseTo(
    a.x - b.x,
    5,
  );
  const before = structuredClone(player.box);
  moveToward(from, { x: 1, y: 0 }, player, 10);
  expect(player.box).toEqual(before);
});
it("screen strength displaces the trailing guard and navigation counters that separation", () => {
  const offense = Array.from({ length: 5 }, (_, i) =>
    actor(i === 4 ? 95 : 10, i),
  );
  const defense = Array.from({ length: 5 }, (_, i) => actor(10, i + 5));
  const c = {
    offense,
    defense,
    guards: new Map(offense.map((p, i) => [p, defense[i]])),
    handler: offense[0],
    screener: offense[4],
    play: "pickRoll" as const,
    tactic: "balanced" as const,
    scheme: "man" as const,
    shotClock: 24,
    periodRemaining: 720,
  };
  const boosted = createCourt(c);
  applyScreenCoverage(boosted, c, "drop");
  c.screener.physicalAbilities = undefined;
  const ordinary = createCourt(c);
  applyScreenCoverage(ordinary, c, "drop");
  expect(boosted.get(defense[0])!.y).toBeGreaterThan(
    ordinary.get(defense[0])!.y,
  );
  c.screener.physicalAbilities = true;
  defense[0].box.pokemonId = 63; // Synchronize: navigation boost.
  const navigate = createCourt(c);
  applyScreenCoverage(navigate, c, "drop");
  expect(navigate.get(defense[0])!.y).toBeLessThan(boosted.get(defense[0])!.y);
  expect(c.screener.box.abilityActivations!.physical!.screens).toBe(2);
  expect(defense[0].box.abilityActivations!.physical!.screens).toBe(1);
});
it("rebound pursuit affects the contest probability and ownership weights without extra random draws", () => {
  const side = Array.from({ length: 5 }, (_, i) => ({
    id: String(i),
    offense: 60,
    defense: 60,
    strength: 60,
    speed: 60,
    vertical: 60,
    passing: 60,
    discipline: 60,
  }));
  const context = {
    zone: "rim" as const,
    tactic: "balanced" as const,
    defenseTactic: "balanced" as const,
  };
  let plainDraws = 0,
    boostDraws = 0;
  const plain = resolveRebound(side, side, context, () => {
    plainDraws++;
    return 0.8;
  });
  const boost = resolveRebound(
    side.map((p) => ({ ...p, abilityRebound: 1.12 })),
    side,
    context,
    () => {
      boostDraws++;
      return 0.8;
    },
  );
  expect(boost.offensiveChance).toBeGreaterThan(plain.offensiveChance);
  expect(boost.attackWeights[0]).toBeGreaterThan(plain.attackWeights[0]);
  expect(boostDraws).toBe(plainDraws);
});

it("strong screens create separation against hedge/trap and navigation closes it", () => {
  for (const coverage of ["hedge", "trap"] as const) {
    const offense = Array.from({ length: 5 }, (_, i) =>
      actor(i === 4 ? 95 : 10, i),
    );
    const defense = Array.from({ length: 5 }, (_, i) => actor(10, i + 5));
    const c = {
      offense,
      defense,
      guards: new Map(offense.map((p, i) => [p, defense[i]])),
      handler: offense[0],
      screener: offense[4],
      play: "pickRoll" as const,
      tactic: "balanced" as const,
      scheme: "man" as const,
      shotClock: 24,
      periodRemaining: 720,
    };
    const gap = () => {
      const court = createCourt(c);
      applyScreenCoverage(court, c, coverage);
      const a = court.get(c.handler)!,
        b = court.get(defense[0])!;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const strong = gap();
    c.screener.physicalAbilities = undefined;
    const ordinary = gap();
    expect(strong).toBeGreaterThan(ordinary);
    c.screener.physicalAbilities = true;
    defense[0].box.pokemonId = 63;
    expect(gap()).toBeLessThan(strong);
  }
});
