import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../../data/pokemon";
import type { PlayerDevelopment } from "../developmentTypes";
import { playerProfile } from "../playerProfile";
import { stepGame } from "./engine";
import { createGame } from "./setup";
import { NO_INPUT, type ArcadeSetup } from "./types";

const setup = (development?: PlayerDevelopment): ArcadeSetup => ({
  teams: [
    {
      name: "Home",
      roster: { PG: 1, SG: 2, SF: 3, PF: 4, C: 5, B1: 65, B2: 7, B3: 8 },
      ...(development ? { development } : {}),
    },
    {
      name: "Away",
      roster: { PG: 20, SG: 21, SF: 22, PF: 23, C: 24, B1: 25, B2: 26, B3: 27 },
    },
  ],
  seed: 42,
});

// Keeps prior exhibition setups and seeded frame updates numerically stable.
it("preserves exact arcade setup and seeded play with no development", () => {
  const state = createGame(setup());
  for (let tick = 0; tick < 500; tick++)
    stepGame(state, {
      ...NO_INPUT,
      moveX: tick % 60 < 30 ? 1 : -1,
      shoot: tick % 70 < 38,
      pass: tick % 90 === 0,
    });
  expect(
    createHash("sha256").update(JSON.stringify(state)).digest("hex"),
  ).toMatchInlineSnapshot(
    `"3d6eebe9a8be212d5863a69ef180f9c53ff6f683f7b661d17428276ba50d06a3"`,
  );
});

describe("developed arcade teams", () => {
  it("loads trained skills and assigns reserves their developed position", () => {
    const base = createGame(setup());
    const trained = createGame(
      setup({
        1: { speed: 15, passing: -8, threePoint: 12 },
        65: {
          passing: -30,
          ballHandling: -30,
          speed: -30,
          block: 30,
          interiorDefense: 30,
          offensiveRebound: 30,
          defensiveRebound: 30,
          strength: 30,
        },
      }),
    );
    expect(
      trained.players[0].attributes.speed - base.players[0].attributes.speed,
    ).toBeCloseTo(15);
    expect(
      trained.players[0].attributes.passing -
        base.players[0].attributes.passing,
    ).toBeCloseTo(-8);
    expect(
      trained.players[0].attributes.shooting -
        base.players[0].attributes.shooting,
    ).toBeCloseTo(6);
    expect(base.players[5].slot).toBe("PG");
    expect(trained.players[5].slot).toBe("C");
    expect(trained.players.slice(8)).toEqual(base.players.slice(8));
  });

  it("changes actual movement and deterministically reproduces the same developed setup", () => {
    const slow = createGame(setup({ 1: { speed: -30 } }));
    const fast = createGame(setup({ 1: { speed: 30 } }));
    const repeated = createGame(setup({ 1: { speed: 30 } }));
    for (const state of [slow, fast, repeated]) {
      state.phase = "live";
      state.ball.mode = "held";
      state.ball.owner = 0;
      state.controlled = 0;
      for (let tick = 0; tick < 20; tick++)
        stepGame(state, { ...NO_INPUT, moveX: 1 });
    }
    expect(fast.players[0].x).toBeGreaterThan(slow.players[0].x);
    expect(fast).toEqual(repeated);
  });

  it("treats explicit zero offsets identically and freezes attributes when inputs change", () => {
    expect(createGame(setup({ 1: { speed: 0, passing: 0 }, 65: {} }))).toEqual(
      createGame(setup()),
    );
    const development: PlayerDevelopment = { 1: { passing: 20 } };
    const source = setup(development),
      game = createGame(source);
    const frozen = structuredClone(game);
    const legacy = structuredClone(playerProfile(POKEMON_BY_ID.get(1)!));
    development[1]!.passing = -20;
    expect(game).toEqual(frozen);
    expect(createGame(source).players[0].attributes.passing).toBeLessThan(
      game.players[0].attributes.passing,
    );
    game.players[0].attributes.passing = 0;
    expect(playerProfile(POKEMON_BY_ID.get(1)!)).toEqual(legacy);
    expect(
      createGame(setup({ 1: { passing: 20 } })).players[0].attributes.passing,
    ).toBe(frozen.players[0].attributes.passing);
  });
});
