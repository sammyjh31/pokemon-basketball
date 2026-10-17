import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  continuePeriod,
  queueSubstitution,
  setPaused,
  stepGame,
} from "./engine";
import { createGame } from "./setup";
import { arcadeLineupChemistry } from "./chemistry";
import { movePlayers } from "./ai";
import { NO_INPUT, type ArcadeSetup, type ArcadeState } from "./types";

const setup = (): ArcadeSetup => ({
  seed: 42,
  chemistryVersion: 1,
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

it("preserves the e5582dc chemistry replay when growth is absent", () => {
  const state = createGame(setup());
  for (let tick = 0; tick < 1000; tick++)
    stepGame(state, {
      ...NO_INPUT,
      moveX: tick % 60 < 30 ? 1 : -1,
      shoot: tick % 70 < 38,
      pass: tick % 90 === 0,
      turbo: tick % 4 === 0,
    });
  expect(createHash("sha256").update(JSON.stringify(state)).digest("hex")).toBe(
    "83a49bb6676ab12cfba1af11bfbab5804f9660571a8b8ae90325e814bf16df50",
  );
  expect(state).not.toHaveProperty("chemistryGrowthVersion");
  expect(state).not.toHaveProperty("chemistryInitial");
  expect(state).not.toHaveProperty("chemistryMinutes");
});

const growingSetup = (): ArcadeSetup => ({
  ...setup(),
  chemistryGrowthVersion: 1,
});

function live(state: ArcadeState) {
  state.phase = "live";
  state.ball.mode = "held";
  state.ball.owner = 0;
  state.controlled = 0;
}

function pair(a: number, b: number) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function expectConserved(state: ArcadeState) {
  for (const [side, key] of [
    [0, "home"],
    [1, "away"],
  ] as const) {
    const minutes = state.chemistryMinutes![key];
    expect(
      Object.values(minutes).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo((state.elapsed / 60) * 10, 10);
    for (const player of state.players.filter((p) => p.team === side)) {
      const shared = Object.entries(minutes)
        .filter(([ids]) =>
          ids.split(":").map(Number).includes(player.pokemonId),
        )
        .reduce((sum, [, value]) => sum + value, 0);
      expect(shared).toBeCloseTo((player.stats.seconds / 60) * 4, 10);
    }
  }
}

describe("earned arcade teammate familiarity", () => {
  it("requires the growth and chemistry versions together", () => {
    expect(() =>
      createGame({ ...growingSetup(), chemistryVersion: undefined }),
    ).toThrow();
    expect(() =>
      createGame({
        ...setup(),
        chemistryGrowthVersion: 2,
      } as unknown as ArcadeSetup),
    ).toThrow();
    expect(createGame(growingSetup()).chemistryGrowthVersion).toBe(1);
  });

  it("validates remembered pair minutes before starting a growth-enabled game", () => {
    const invalid: Record<string, number>[] = [
      { "92:84": 20 },
      { "84:92": Number.NaN },
      { "84:92": 6001 },
      { "84:92": 0.001 },
      { "84:99999": 1 },
    ];
    for (const chemistryBonds of invalid) {
      const source = growingSetup();
      source.teams[0].chemistryBonds = chemistryBonds;
      expect(() => createGame(source)).toThrow();
    }
  });

  it("ignores relationship banks when the arcade growth version is absent", () => {
    const source = setup();
    const original = createGame(source);
    source.teams[0].chemistryGrowthVersion = 1;
    source.teams[0].chemistryBonds = { "84:92": 6000 };
    expect(createGame(source)).toEqual(original);
  });

  it("keeps archived off-roster relationships outside the per-frame chemistry cache", () => {
    const source = growingSetup();
    source.teams[0].chemistryBonds = { "84:92": 600, "1:2": 1200 };
    const state = createGame(source);
    expect(state.chemistryContexts![0].bonds).toEqual({ "84:92": 600 });
    expect(source.teams[0].chemistryBonds).toEqual({
      "84:92": 600,
      "1:2": 1200,
    });
  });

  it("credits only the ten active pairs for actual clock time, including partial final ticks", () => {
    const state = createGame(growingSetup());
    live(state);
    stepGame(state, NO_INPUT, 1 / 30);
    expect(Object.keys(state.chemistryMinutes!.home)).toHaveLength(10);
    expect(Object.keys(state.chemistryMinutes!.away)).toHaveLength(10);
    expect(state.chemistryMinutes!.home["84:92"]).toBeCloseTo(1 / 1800, 12);
    expect(
      Object.keys(state.chemistryMinutes!.home).some((key) =>
        key.split(":").includes("7"),
      ),
    ).toBe(false);
    state.clock = 0.007;
    stepGame(state, NO_INPUT, 1 / 30);
    expect(state.phase).toBe("break");
    expect(state.elapsed).toBeCloseTo(1 / 30 + 0.007, 12);
    expectConserved(state);
  });

  it("excludes paused, tipoff, inbound, break and expired-clock buzzer flight time", () => {
    const state = createGame(growingSetup());
    for (let tick = 0; tick < 10; tick++) stepGame(state);
    expect(state.chemistryMinutes).toEqual({ home: {}, away: {} });
    live(state);
    stepGame(state);
    const earned = structuredClone(state.chemistryMinutes);
    setPaused(state, true);
    for (let tick = 0; tick < 10; tick++) stepGame(state);
    expect(state.chemistryMinutes).toEqual(earned);
    setPaused(state, false);
    state.phase = "inbound";
    for (let tick = 0; tick < 10; tick++) stepGame(state);
    expect(state.chemistryMinutes).toEqual(earned);
    state.phase = "break";
    for (let tick = 0; tick < 10; tick++) stepGame(state);
    expect(state.chemistryMinutes).toEqual(earned);
    live(state);
    state.clock = 0;
    Object.assign(state.ball, {
      mode: "shot",
      owner: null,
      from: 0,
      duration: 1,
      travel: 0,
    });
    for (let tick = 0; tick < 10; tick++) stepGame(state);
    expect(state.chemistryMinutes).toEqual(earned);
    expectConserved(state);
  });

  it("splits exposure at substitutions and keeps accumulating through overtime", () => {
    const state = createGame({ ...growingSetup(), official: true });
    live(state);
    state.period = 4;
    state.clock = 0.02;
    state.score = [2, 2];
    stepGame(state, NO_INPUT, 1 / 30);
    expect(state.phase).toBe("break");
    const original = state.chemistryMinutes!.home["84:92"];
    expect(queueSubstitution(state, 0, 5)).toBe(true);
    continuePeriod(state);
    expect(state.period).toBe(5);
    expect(state.clock).toBe(25);
    live(state);
    state.ball.owner = 5;
    state.clock = 0.009;
    state.score = [4, 2];
    stepGame(state, NO_INPUT, 1 / 30);
    expect(state.phase).toBe("final");
    expect(state.chemistryMinutes!.home["84:92"]).toBe(original);
    expect(state.chemistryMinutes!.home["7:92"]).toBeCloseTo(0.009 / 60, 12);
    expect(state.chemistryMinutes!.home["7:84"]).toBeUndefined();
    expectConserved(state);
  });

  it("freezes pregame bonds and applies existing connections with abilities disabled", () => {
    const source = growingSetup();
    source.abilityVersion = undefined;
    source.teams[0].chemistryBonds = Object.fromEntries(
      [84, 92, 52, 95, 113].flatMap((id, i, ids) =>
        ids.slice(i + 1).map((mate) => [pair(id, mate), 6000]),
      ),
    );
    const familiar = createGame(source);
    const newTeam = createGame({
      ...source,
      teams: [{ ...source.teams[0], chemistryBonds: {} }, source.teams[1]],
    });
    const before = structuredClone(arcadeLineupChemistry(familiar, 0)!);
    expect(before.score).toBeGreaterThan(
      arcadeLineupChemistry(newTeam, 0)!.score,
    );
    expect(familiar.chemistryInitial!.home).toHaveLength(28);
    expect(
      familiar.chemistryInitial!.home.filter((value) => value === 6000),
    ).toHaveLength(10);
    source.teams[0].chemistryBonds["84:92"] = 0;
    expect(familiar.chemistryContexts![0].bonds!["84:92"]).toBe(6000);
    for (const state of [familiar, newTeam]) {
      live(state);
      state.possession = 1;
      state.ball.owner = 8;
      movePlayers(state, { ...NO_INPUT, moveX: 1 }, 1 / 60);
    }
    expect(familiar.players[0].x).not.toBe(newTeam.players[0].x);
    expect(familiar.seed).toBe(newTeam.seed);
    stepGame(familiar);
    expectConserved(familiar);
    expect(arcadeLineupChemistry(familiar, 0)).toEqual(before);
    expect(familiar.players[0].stats.abilityActivations).toBeUndefined();
  });

  it("invalidates lineup effects when frozen-context bonds are deliberately replaced", () => {
    const state = createGame(growingSetup());
    const before = arcadeLineupChemistry(state, 0)!;
    state.chemistryContexts![0].bonds = { "84:92": 6000 };
    const after = arcadeLineupChemistry(state, 0)!;
    expect(after).not.toBe(before);
    expect(after.score).toBeGreaterThan(before.score);
  });

  it("repeats growth-enabled seeded play exactly without adding random draws", () => {
    const first = createGame(growingSetup()),
      repeated = createGame(growingSetup()),
      legacy = createGame(setup());
    for (let tick = 0; tick < 700; tick++) {
      const input = {
        ...NO_INPUT,
        moveX: tick % 60 < 30 ? 1 : -1,
        shoot: tick % 70 < 38,
        pass: tick % 90 === 0,
      };
      stepGame(first, input);
      stepGame(repeated, input);
      stepGame(legacy, input);
    }
    expect(first).toEqual(repeated);
    expect(first.seed).toBe(legacy.seed);
    expect(first.players).toEqual(legacy.players);
    expect(first.score).toEqual(legacy.score);
    expectConserved(first);
  });
});
