import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { changeArcadeEnergy } from "./abilities";
import { advanceBall, giveBall, makePass } from "./actions";
import { movePlayers } from "./ai";
import { continuePeriod, queueSubstitution, stepGame } from "./engine";
import { createGame } from "./setup";
import { NO_INPUT, type ArcadeSetup } from "./types";
import { arcadeChemistryEffects, arcadeLineupChemistry } from "./chemistry";
import { chooseCpuSubstitution } from "./coaching";

const setup = (): ArcadeSetup => ({
  seed: 42,
  abilityVersion: 1,
  physicalAbilityVersion: 1,
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
function scenario(chemistry = true, physical = false) {
  const state = createGame({
    ...setup(),
    physicalAbilityVersion: physical ? 1 : undefined,
    ...(chemistry ? { chemistryVersion: 1 as const } : {}),
  });
  state.phase = "live";
  for (const p of state.players) {
    p.x = 2 + (p.id % 8) * 3;
    p.y = p.team === 0 ? 2 : 13;
  }
  state.players[0].x = 10;
  state.players[0].y = 7.5;
  giveBall(state, state.players[0]);
  return state;
}

describe("active-five arcade chemistry", () => {
  it("preserves the frozen physical-ability replay and serialized shape without the chemistry version", () => {
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
    ).toBe("b0b38e2207a91a896df6564d7f8c548d58ab3742730586742422cd58292ece30");
    expect(state).not.toHaveProperty("chemistryVersion");
    expect(state).not.toHaveProperty("chemistryContexts");
    expect(state.players.every((p) => !("chemistryProfile" in p))).toBe(true);
  });

  it("validates the chemistry version and preserves independent opt-in with abilities off", () => {
    expect(() =>
      createGame({ ...setup(), chemistryVersion: 2 } as unknown as ArcadeSetup),
    ).toThrow();
    const state = createGame({
      ...setup(),
      chemistryVersion: 1,
      abilityVersion: undefined,
    });
    expect(state.chemistryVersion).toBe(1);
    expect(state).not.toHaveProperty("abilityVersion");
    expect(
      state.players.every(
        (p) => p.chemistryProfile?.attributes.passing === p.attributes.passing,
      ),
    ).toBe(true);
  });

  it("changes active movement without rewriting ratings or drawing randomness", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy])
      movePlayers(state, { ...NO_INPUT, moveX: 1 }, 1 / 60);
    expect(enabled.players[0].x).not.toBe(legacy.players[0].x);
    expect(enabled.players.map((p) => p.attributes)).toEqual(
      legacy.players.map((p) => p.attributes),
    );
    expect(enabled.seed).toBe(legacy.seed);
    expect(
      enabled.players[0].stats.abilityActivations?.physical,
    ).toBeUndefined();
  });

  it("changes pass flight and catches while keeping the same random stream", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      state.players[1].x = 15;
      state.players[1].y = 7.5;
      makePass(state, state.players[0], state.players[1]);
    }
    expect(enabled.ball.duration).not.toBe(legacy.ball.duration);
    for (const state of [enabled, legacy]) {
      advanceBall(state, 1);
      expect(state.ball.owner).toBe(1);
    }
    expect(enabled.seed).toBe(legacy.seed);
  });

  it("applies partner energy savings only to active drain and attributes physical savings after chemistry", () => {
    const enabled = scenario(true, true),
      withoutPhysical = scenario(true, false),
      legacy = scenario(false, false);
    for (const state of [enabled, withoutPhysical, legacy]) {
      state.players[0].energy = 50;
      state.players[4].energy = 50;
      changeArcadeEnergy(state, state.players[0], -10);
      changeArcadeEnergy(state, state.players[4], -10);
    }
    expect(withoutPhysical.players[0].energy).toBeGreaterThan(
      legacy.players[0].energy,
    );
    expect(
      enabled.players[4].stats.abilityActivations?.physical?.energySaved,
    ).toBeCloseTo(
      enabled.players[4].energy - withoutPhysical.players[4].energy,
      6,
    );
    expect(
      withoutPhysical.players[0].stats.abilityActivations?.physical,
    ).toBeUndefined();
    for (const state of [withoutPhysical, legacy]) {
      state.players[0].active = false;
      state.players[0].energy = 50;
      changeArcadeEnergy(state, state.players[0], -10);
    }
    expect(withoutPhysical.players[0].energy).toBe(legacy.players[0].energy);
  });

  it("refreshes partner benefits when manual substitutions remove and return the donor", () => {
    const state = scenario();
    state.players[0].energy = 50;
    changeArcadeEnergy(state, state.players[0], -10);
    const linked = state.players[0].energy;
    state.phase = "break";
    queueSubstitution(state, 4, 5); // Chansey's endurance partnership leaves the court.
    continuePeriod(state);
    state.players[0].energy = 50;
    changeArcadeEnergy(state, state.players[0], -10);
    expect(state.players[0].energy).toBeLessThan(linked);
    state.phase = "break";
    queueSubstitution(state, 5, 4);
    continuePeriod(state);
    state.players[0].energy = 50;
    changeArcadeEnergy(state, state.players[0], -10);
    expect(state.players[0].energy).toBe(linked);
  });

  it("repeats versioned play after serialization and keeps all values finite and bounded", () => {
    const a = scenario(true, true),
      b = JSON.parse(JSON.stringify(a));
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
    for (const p of a.players) {
      expect(p.energy).toBeGreaterThanOrEqual(0);
      expect(p.energy).toBeLessThanOrEqual(100);
      expect(p.x).toBeGreaterThanOrEqual(0.4);
      expect(p.x).toBeLessThanOrEqual(27.6);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it("keeps basketball coordination active when ability links are disabled", () => {
    const state = scenario(),
      legacy = scenario(false);
    delete state.abilityVersion;
    delete legacy.abilityVersion;
    expect(arcadeLineupChemistry(state, 0)?.links).toEqual([]);
    const effects = arcadeChemistryEffects(state, state.players[0]);
    expect(effects.passing).not.toBe(1);
    expect(effects.movement).toBe(1);
    expect(effects.drain).toBe(1);
    for (const s of [state, legacy]) makePass(s, s.players[0], s.players[1]);
    expect(state.ball.duration).not.toBe(legacy.ball.duration);
    expect(state.seed).toBe(legacy.seed);
  });

  it("ignores bench donors and refreshes actual ratings, ability rules and schemes", () => {
    const state = scenario();
    const first = arcadeLineupChemistry(state, 0)!;
    state.players[5].pokemonId = 311;
    state.players[5].attributes.passing = 100;
    expect(arcadeLineupChemistry(state, 0)).toBe(first);
    expect(
      first.links.every((link) =>
        link.pokemonIds.every((id) =>
          state.players.some(
            (p) => p.active && p.team === 0 && p.pokemonId === id,
          ),
        ),
      ),
    ).toBe(true);
    state.chemistryContexts![0].defense = "press";
    const press = arcadeLineupChemistry(state, 0)!;
    expect(press.effects[84].drain).toBeLessThan(first.effects[84].drain);
    state.players[0].attributes.passing = 100;
    const developed = arcadeLineupChemistry(state, 0)!;
    expect(developed.score).not.toBe(press.score);
    delete state.abilityVersion;
    expect(arcadeLineupChemistry(state, 0)!.links).toEqual([]);
  });

  it("snapshots local familiarity independently from the actual court ability rule", () => {
    const source = setup();
    source.chemistryVersion = 1;
    source.abilityVersion = undefined;
    source.teams[0].engineRules = { abilities: true, familiarity: 0.75 };
    const familiar = createGame(source);
    const before = arcadeLineupChemistry(familiar, 0)!;
    source.teams[0].engineRules.familiarity = 0;
    const unfamiliar = createGame(source);
    expect(before.score).toBeGreaterThan(
      arcadeLineupChemistry(unfamiliar, 0)!.score,
    );
    expect(before.score).toBeLessThanOrEqual(
      arcadeLineupChemistry(unfamiliar, 0)!.score + 4,
    );
    expect(before.links).toEqual([]);
    expect(arcadeLineupChemistry(familiar, 0)).toBe(before);
    expect(familiar.chemistryContexts![0].familiarity).toBe(0.75);
  });

  it("measures only individual extra movement above the partner-assisted baseline", () => {
    const enabled = scenario(true, true),
      baseline = scenario(true, false);
    for (const state of [enabled, baseline])
      movePlayers(state, { ...NO_INPUT, moveX: 1 }, 1 / 60);
    expect(enabled.players[0].x).toBeGreaterThan(baseline.players[0].x);
    expect(
      enabled.players[0].stats.abilityActivations?.physical?.movement,
    ).toBeCloseTo((enabled.players[0].x - baseline.players[0].x) * 3.28084, 6);
  });

  it("changes screen displacement without reporting chemistry as an individual screen activation", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      Object.assign(state.players[3], {
        x: 12,
        y: 7.5,
        action: "screen",
        actionTime: 1,
      });
      Object.assign(state.players[8], { x: 12.5, y: 7.5 });
      movePlayers(state, NO_INPUT, 1 / 60);
    }
    expect(enabled.players[3].x).not.toBe(legacy.players[3].x);
    expect(
      enabled.players[3].stats.abilityActivations?.physical,
    ).toBeUndefined();
    expect(enabled.seed).toBe(legacy.seed);
  });

  it("changes a close missed-shot rebound without changing ordinary loose-ball pickups", () => {
    for (const reboundOf of [0, null] as const) {
      const enabled = scenario(),
        legacy = scenario(false);
      for (const state of [enabled, legacy]) {
        Object.assign(state.players[2], { x: 14.641, y: 7.5 });
        Object.assign(state.players[8], { x: 13.36, y: 7.5 });
        state.players[2].attributes.rebounding = 50;
        state.players[8].attributes.rebounding = 50;
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
        enabled.players[2].stats.abilityActivations?.physical,
      ).toBeUndefined();
      expect(enabled.seed).toBe(legacy.seed);
    }
  });

  it("selects a complementary CPU five while preserving roles, cooldown and fatigue", () => {
    const state = scenario();
    delete state.abilityVersion;
    delete state.typeMatchupsVersion;
    for (const p of state.players) {
      for (const key of Object.keys(
        p.attributes,
      ) as (keyof typeof p.attributes)[])
        p.attributes[key] = 0;
      p.roleScores = { PG: 50, SG: 50, SF: 50, PF: 50, C: 50 };
    }
    Object.assign(state.players[8].attributes, {
      passing: 100,
      ballHandling: 100,
    });
    state.players[9].attributes.threePoint = 100;
    state.players[10].attributes.finishing = 100;
    state.players[11].attributes.perimeterDefense = 100;
    Object.assign(state.players[13].attributes, {
      interiorDefense: 100,
      composure: 100,
    });
    state.players[13].roleScores!.C = 52;
    state.players[14].roleScores = state.players[15].roleScores = {
      PG: 0,
      SG: 0,
      SF: 0,
      PF: 0,
      C: 0,
    };
    const legacy = structuredClone(state);
    delete legacy.chemistryVersion;
    expect(chooseCpuSubstitution(legacy)).toBeUndefined();
    expect(chooseCpuSubstitution(state)).toEqual({ outId: 12, inId: 13 });
    state.players[13].energy = 10;
    expect(chooseCpuSubstitution(state)).toBeUndefined();
    state.players[13].energy = 100;
    state.phase = "break";
    continuePeriod(state);
    expect(state.players[13].active).toBe(true);
    expect(state.players[13].slot).toBe("C");
    expect(arcadeLineupChemistry(state, 1)?.effects).toHaveProperty(
      String(state.players[13].pokemonId),
    );
    expect(arcadeLineupChemistry(state, 1)?.effects).not.toHaveProperty(
      String(state.players[12].pokemonId),
    );
    expect(chooseCpuSubstitution(state)).toBeUndefined();
    state.players[13].energy = 0;
    expect(chooseCpuSubstitution(state)?.outId).toBe(13);
  });

  it("lets a live Plus / Minus partnership complete a marginal catch", () => {
    const source = setup();
    source.teams[0].roster.PG = 311;
    source.teams[0].roster.SG = 312;
    const enabled = createGame({ ...source, chemistryVersion: 1 }),
      legacy = createGame(source);
    for (const state of [enabled, legacy]) {
      state.phase = "live";
      for (const p of state.players) {
        p.x = 2 + (p.id % 8) * 3;
        p.y = p.team === 0 ? 2 : 13;
        for (const key of Object.keys(
          p.attributes,
        ) as (keyof typeof p.attributes)[])
          p.attributes[key] = 100;
      }
      Object.assign(state.players[0], { x: 10, y: 7.5 });
      Object.assign(state.players[1], { x: 15, y: 7.5 });
      giveBall(state, state.players[0]);
      makePass(state, state.players[0], state.players[1]);
      state.players[1].x = 17.3;
      advanceBall(state, 1);
    }
    expect(enabled.ball.owner).toBe(1);
    expect(legacy.ball.mode).toBe("loose");
    expect(enabled.players[0].stats.abilityActivations?.support).toBe(0);
    expect(enabled.players[1].stats.abilityActivations?.offense).toBe(0);
    expect(enabled.seed).toBe(legacy.seed);
  });

  it("protects a passing lane with the same interception roll and no invented ability activations", () => {
    const source = setup();
    source.teams[0].roster.PG = 311;
    source.teams[0].roster.SG = 312;
    source.typeMatchupsVersion = undefined;
    source.seed = 129; // The first roll is 0.17906, between these two interception chances.
    const enabled = createGame({ ...source, chemistryVersion: 1 }),
      legacy = createGame(source);
    for (const state of [enabled, legacy]) {
      state.phase = "live";
      for (const p of state.players) {
        p.x = 2 + (p.id % 8) * 3;
        p.y = p.team === 0 ? 2 : 13;
        for (const key of Object.keys(
          p.attributes,
        ) as (keyof typeof p.attributes)[])
          p.attributes[key] = p.team === 0 ? 100 : 0;
      }
      Object.assign(state.players[0], { x: 10, y: 7.5 });
      Object.assign(state.players[1], { x: 20, y: 7.5 });
      Object.assign(state.players[8], { x: 11.5, y: 7.5 });
      state.players[8].attributes.steal = 50;
      giveBall(state, state.players[0]);
      makePass(state, state.players[0], state.players[1]);
      state.ball.duration = 1;
      advanceBall(state, 0.15);
    }
    expect(enabled.ball.mode).toBe("pass");
    expect(legacy.ball.owner).toBe(8);
    expect(enabled.players[0].stats.abilityActivations?.support).toBe(0);
    expect(enabled.seed).toBe(legacy.seed);
  });

  it("finishes a chemistry-enabled game with conserved scoring and ten active players", () => {
    const state = createGame({ ...setup(), chemistryVersion: 1 });
    for (let tick = 0; tick < 60000 && state.phase !== "final"; tick++) {
      if (state.phase === "break") continuePeriod(state);
      state.controlled = -1;
      stepGame(state, NO_INPUT);
    }
    expect(state.phase).toBe("final");
    for (const team of [0, 1] as const) {
      const players = state.players.filter((p) => p.team === team);
      expect(players.filter((p) => p.active)).toHaveLength(5);
      expect(players.reduce((n, p) => n + p.stats.points, 0)).toBe(
        state.score[team],
      );
      expect(players.reduce((n, p) => n + p.stats.seconds, 0)).toBeCloseTo(
        state.elapsed * 5,
        5,
      );
    }
    for (const player of state.players)
      for (const amount of Object.values(
        player.stats.abilityActivations?.physical ?? {},
      )) {
        expect(Number.isFinite(amount)).toBe(true);
        expect(amount).toBeGreaterThanOrEqual(0);
      }
  }, 15000);
});
