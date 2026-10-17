import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { advanceBall, giveBall, releaseShot } from "./actions";
import { movePlayers } from "./ai";
import { continuePeriod, stepGame } from "./engine";
import { createGame } from "./setup";
import { NO_INPUT, type ArcadeSetup } from "./types";

const setup = (): ArcadeSetup => ({
  seed: 42,
  abilityVersion: 1,
  evaluationVersion: 1,
  typeMatchupsVersion: 1,
  teams: [
    {
      name: "A",
      roster: { PG: 84, SG: 92, SF: 52, PF: 95, C: 113, B1: 7, B2: 8, B3: 9 },
    },
    {
      name: "B",
      roster: { PG: 20, SG: 21, SF: 22, PF: 23, C: 24, B1: 25, B2: 26, B3: 27 },
    },
  ],
});

function scenario(physical = true) {
  const state = createGame({
    ...setup(),
    ...(physical ? { physicalAbilityVersion: 1 as const } : {}),
  });
  state.phase = "live";
  for (const p of state.players) {
    p.x = 2 + (p.id % 8) * 3;
    p.y = p.team === 0 ? 2 : 13;
    for (const key of Object.keys(
      p.attributes,
    ) as (keyof typeof p.attributes)[])
      p.attributes[key] = 50;
  }
  state.players[0].x = 10;
  state.players[0].y = 7.5;
  giveBall(state, state.players[0]);
  return state;
}

describe("arcade physical ability version", () => {
  it("preserves the frozen current arcade replay when the physical version is absent", () => {
    const state = createGame(setup());
    for (let tick = 0; tick < 1000; tick++)
      stepGame(state, {
        ...NO_INPUT,
        moveX: tick % 60 < 30 ? 1 : -1,
        shoot: tick % 70 < 38,
        pass: tick % 90 === 0,
        turbo: tick % 4 === 0,
      });
    expect(
      createHash("sha256").update(JSON.stringify(state)).digest("hex"),
    ).toBe("63413f4f8053cf0b666ea61222108fe8cf6381098c113efc2fc8978d567eaf1f");
    expect(state).not.toHaveProperty("physicalAbilityVersion");
  });

  it("validates and preserves the opt-in flag without enabling abilities on its own", () => {
    expect(() =>
      createGame({
        ...setup(),
        physicalAbilityVersion: 2,
      } as unknown as ArcadeSetup),
    ).toThrow();
    const enabled = scenario();
    expect(enabled.physicalAbilityVersion).toBe(1);
    const disabled = createGame({
      ...setup(),
      abilityVersion: undefined,
      physicalAbilityVersion: 1,
    });
    const legacy = createGame({ ...setup(), abilityVersion: undefined });
    for (const state of [disabled, legacy]) {
      state.phase = "live";
      movePlayers(state, { ...NO_INPUT, moveX: 1, turbo: true }, 1 / 60);
    }
    const { physicalAbilityVersion: _, ...withoutFlag } = disabled;
    expect(withoutFlag).toEqual(legacy);
  });

  it("snapshots physical coaching value only when that effect is active on this court", () => {
    const source = setup();
    source.teams[0].physicalAbilityVersion = 1;
    const legacy = createGame(source),
      enabled = createGame({ ...source, physicalAbilityVersion: 1 });
    expect(enabled.players[0].roleScores!.PG).toBeGreaterThan(
      legacy.players[0].roleScores!.PG,
    );
    const off = createGame({
      ...source,
      physicalAbilityVersion: 1,
      abilityVersion: undefined,
    });
    const plain = createGame({ ...source, abilityVersion: undefined });
    expect(off.players.map((p) => p.roleScores)).toEqual(
      plain.players.map((p) => p.roleScores),
    );
  });
});

describe("arcade physical actions", () => {
  it("moves faster from the same attributes and counts only actual extra feet after court bounds", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy])
      movePlayers(state, { ...NO_INPUT, moveX: 1 }, 1 / 60);
    const p = enabled.players[0];
    expect(p.x).toBeGreaterThan(legacy.players[0].x);
    expect(p.attributes).toEqual(legacy.players[0].attributes);
    expect(p.stats.abilityActivations?.physical?.movement).toBeCloseTo(
      (p.x - legacy.players[0].x) * 3.28084,
      6,
    );
    expect(enabled.seed).toBe(legacy.seed);
    const total = p.stats.abilityActivations?.physical?.movement;
    p.x = 27.6;
    movePlayers(enabled, { ...NO_INPUT, moveX: 1 }, 1 / 60);
    expect(p.stats.abilityActivations?.physical?.movement).toBe(total);
    expect(p.stats.abilityActivations?.offense).toBe(0);
  });

  it("changes a close rebound contest only for actual missed-shot loose balls", () => {
    for (const reboundOf of [0, null] as const) {
      const enabled = scenario(),
        legacy = scenario(false);
      for (const state of [enabled, legacy]) {
        const collector = state.players[2],
          opponent = state.players[8];
        collector.x = 14.65;
        collector.y = 7.5;
        opponent.x = 13.36;
        opponent.y = 7.5;
        Object.assign(state.ball, {
          mode: "loose",
          owner: null,
          x: 14,
          y: 7.5,
          z: 0,
          reboundOf,
        });
        advanceBall(state, 1 / 60);
      }
      expect(legacy.ball.owner).toBe(8);
      expect(enabled.ball.owner).toBe(reboundOf === null ? 8 : 2);
      expect(
        enabled.players[2].stats.abilityActivations?.physical?.rebounds ?? 0,
      ).toBe(reboundOf === null ? 0 : 1);
      expect(enabled.seed).toBe(legacy.seed);
      advanceBall(enabled, 1 / 60);
      expect(
        enabled.players[2].stats.abilityActivations?.physical?.rebounds ?? 0,
      ).toBe(reboundOf === null ? 0 : 1);
    }
  });

  it("conserves turbo energy and counts recovery only beyond the capped ordinary recovery", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      state.players[0].pokemonId = 113;
      state.players[0].energy = 50;
      movePlayers(state, { ...NO_INPUT, moveX: 1, turbo: true }, 1 / 60);
    }
    const p = enabled.players[0];
    expect(p.energy).toBeGreaterThan(legacy.players[0].energy);
    expect(p.stats.abilityActivations?.physical?.energySaved).toBeCloseTo(
      p.energy - legacy.players[0].energy,
      6,
    );
    const saved = p.stats.abilityActivations?.physical?.energySaved;
    p.active = false;
    p.energy = 99.9;
    movePlayers(enabled, NO_INPUT, 1 / 60);
    expect(p.energy).toBe(100);
    expect(p.stats.abilityActivations?.physical?.energySaved).toBe(saved);
    p.energy = 50;
    movePlayers(enabled, NO_INPUT, 1 / 60);
    expect(p.energy).toBeGreaterThan(50.2);
    const beforeBreak = p.stats.abilityActivations?.physical?.energySaved ?? 0;
    enabled.phase = "break";
    continuePeriod(enabled);
    expect(p.energy).toBeGreaterThan(68.2);
    expect(p.stats.abilityActivations?.physical?.energySaved).toBeGreaterThan(
      beforeBreak,
    );
  });

  it("changes opposing screen contact once per encounter", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    const place = (state: typeof enabled) => {
      const screener = state.players[3],
        defender = state.players[8];
      screener.x = 12;
      screener.y = 7.5;
      screener.action = "screen";
      screener.actionTime = 1;
      defender.x = 12.5;
      defender.y = 7.5;
    };
    for (const state of [enabled, legacy]) {
      place(state);
      movePlayers(state, NO_INPUT, 1 / 60);
    }
    expect(enabled.players[3].x).toBeGreaterThan(legacy.players[3].x);
    expect(enabled.players[3].stats.abilityActivations?.physical?.screens).toBe(
      1,
    );
    place(enabled);
    movePlayers(enabled, NO_INPUT, 1 / 60);
    expect(enabled.players[3].stats.abilityActivations?.physical?.screens).toBe(
      1,
    );
    enabled.players[8].x = 20;
    movePlayers(enabled, NO_INPUT, 1 / 60);
    place(enabled);
    movePlayers(enabled, NO_INPUT, 1 / 60);
    expect(enabled.players[3].stats.abilityActivations?.physical?.screens).toBe(
      2,
    );
  });

  it("uses navigation to reduce displacement against an opposing screen", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      const navigator = state.players[0],
        screener = state.players[8];
      navigator.pokemonId = 96; // Insomnia: navigation without a movement effect.
      navigator.x = 12;
      navigator.y = 7.5;
      screener.pokemonId = 1; // Neutral physical effect at full energy.
      screener.x = 12.5;
      screener.y = 7.5;
      screener.action = "screen";
      screener.actionTime = 1;
      movePlayers(state, NO_INPUT, 1 / 60);
    }
    expect(enabled.players[0].x).toBeGreaterThan(legacy.players[0].x);
    expect(enabled.players[0].stats.abilityActivations?.physical?.screens).toBe(
      1,
    );
    expect(
      enabled.players[8].stats.abilityActivations?.physical?.screens ?? 0,
    ).toBe(0);
  });

  it("does not credit teammate collisions, neutral contacts, or uncontested pickups", () => {
    const state = scenario();
    for (const p of state.players) p.pokemonId = 1;
    const screener = state.players[3],
      teammate = state.players[2];
    screener.pokemonId = 95;
    screener.x = 12;
    screener.y = 7.5;
    screener.action = "screen";
    screener.actionTime = 1;
    teammate.x = 12.5;
    teammate.y = 7.5;
    movePlayers(state, NO_INPUT, 1 / 60);
    expect(screener.stats.abilityActivations?.physical?.screens ?? 0).toBe(0);
    expect(state).not.toHaveProperty("physicalScreenContacts");
    screener.x = 20;
    teammate.x = 14;
    teammate.pokemonId = 52;
    Object.assign(state.ball, {
      mode: "loose",
      owner: null,
      x: 14,
      y: 7.5,
      z: 0,
      reboundOf: 0,
    });
    advanceBall(state, 1 / 60);
    expect(state.ball.owner).toBe(teammate.id);
    expect(teammate.stats.abilityActivations?.physical?.rebounds ?? 0).toBe(0);
  });

  it("counts actual idle recovery and dunk savings without changing shot activations", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      state.players[0].pokemonId = 113;
      state.players[0].energy = 50;
      movePlayers(state, NO_INPUT, 1 / 60);
    }
    expect(enabled.players[0].energy - legacy.players[0].energy).toBeCloseTo(
      0.015,
      6,
    );
    expect(
      enabled.players[0].stats.abilityActivations?.physical?.energySaved,
    ).toBeCloseTo(0.015, 6);
    for (const state of [enabled, legacy]) {
      state.players[0].x = 25;
      releaseShot(state, state.players[0], 0.65, true);
    }
    expect(enabled.ball.dunk).toBe(true);
    expect(enabled.players[0].energy - legacy.players[0].energy).toBeCloseTo(
      1.815,
      6,
    );
    expect(
      enabled.players[0].stats.abilityActivations?.physical?.energySaved,
    ).toBeCloseTo(1.815, 6);
    expect(enabled.players[0].stats.abilityActivations?.offense).toBe(
      legacy.players[0].stats.abilityActivations?.offense,
    );
  });

  it("does not introduce a contact record for physically neutral opposing screens", () => {
    const state = scenario();
    for (const p of state.players) p.pokemonId = 1;
    const a = state.players[0],
      b = state.players[8];
    a.x = 12;
    a.y = 7.5;
    a.attributes.strength = 52;
    b.x = 12.5;
    b.y = 7.5;
    b.attributes.strength = 0;
    b.action = "screen";
    b.actionTime = 1;
    movePlayers(state, NO_INPUT, 1 / 60);
    expect(state).not.toHaveProperty("physicalScreenContacts");
    expect(
      state.players.every((p) => !p.stats.abilityActivations?.physical),
    ).toBe(true);
  });

  it("repeats enabled spatial play exactly from the same seed and input", () => {
    const a = createGame({ ...setup(), physicalAbilityVersion: 1 }),
      b = structuredClone(a);
    for (let tick = 0; tick < 1000; tick++) {
      const input = {
        ...NO_INPUT,
        moveX: tick % 50 < 25 ? 1 : -1,
        shoot: tick % 60 < 35,
        pass: tick % 80 === 0,
        turbo: tick % 3 === 0,
      };
      stepGame(a, input);
      stepGame(b, input);
    }
    expect(a).toEqual(b);
    expect(
      a.players.some(
        (p) => (p.stats.abilityActivations?.physical?.movement ?? 0) > 0,
      ),
    ).toBe(true);
  });

  it("finishes enabled CPU play with conserved scoring and finite actual physical totals", () => {
    const state = createGame({ ...setup(), physicalAbilityVersion: 1 });
    for (let tick = 0; tick < 60000 && state.phase !== "final"; tick++) {
      if (state.phase === "break") continuePeriod(state);
      state.controlled = -1;
      stepGame(state, NO_INPUT);
    }
    expect(state.phase).toBe("final");
    for (const team of [0, 1] as const) {
      expect(
        state.players
          .filter((p) => p.team === team)
          .reduce((total, p) => total + p.stats.points, 0),
      ).toBe(state.score[team]);
      expect(
        state.players.filter((p) => p.team === team && p.active),
      ).toHaveLength(5);
    }
    for (const p of state.players)
      for (const total of Object.values(
        p.stats.abilityActivations?.physical ?? {},
      )) {
        expect(Number.isFinite(total)).toBe(true);
        expect(total).toBeGreaterThanOrEqual(0);
      }
  });
});
