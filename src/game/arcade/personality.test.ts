import { describe, expect, it } from "vitest";
import { ROSTER_SLOTS, type RosterSlot } from "../types";
import { arcadeLineupChemistry } from "./chemistry";
import { continuePeriod, queueSubstitution, stepGame } from "./engine";
import { createGame } from "./setup";
import { NO_INPUT, type ArcadeSetup, type ArcadeState } from "./types";

function setup(): ArcadeSetup {
  const source: ArcadeSetup = {
    seed: 42,
    chemistryVersion: 1,
    chemistryGrowthVersion: 1,
    moraleVersion: 1,
    personalityVersion: 1,
    evaluationVersion: 1,
    teams: [
      {
        name: "A",
        coach: { version: 1, id: "brock" },
        roster: { PG: 84, SG: 92, SF: 52, PF: 95, C: 113, B1: 7, B2: 8, B3: 9 },
        chemistryBonds: { "7:8": 3000, "7:84": 1200, "1:2": 6000 },
        development: { 7: { composure: 8 } },
      },
      {
        name: "B",
        coach: { version: 1, id: "ash" },
        roster: {
          PG: 20,
          SG: 21,
          SF: 22,
          PF: 23,
          C: 24,
          B1: 25,
          B2: 26,
          B3: 27,
        },
      },
    ],
  };
  for (const team of source.teams) {
    team.moraleVersion = 1;
    team.personalityVersion = 1;
    team.morale = Object.fromEntries(
      Object.values(team.roster).map((id) => [
        id,
        { score: 85, minutes: 30, success: 60, disruption: 0, games: 20 },
      ]),
    );
  }
  return source;
}

function moveToSlot(source: ArcadeSetup, id: number, slot: RosterSlot) {
  const roster = source.teams[0].roster;
  const previous = ROSTER_SLOTS.find((key) => roster[key] === id)!;
  [roster[previous], roster[slot]] = [roster[slot], roster[previous]];
}

function withoutLeadership(state: ArcadeState) {
  const neutral = structuredClone(state);
  delete neutral.chemistryContexts![0].leadership;
  return arcadeLineupChemistry(neutral, 0)!;
}

describe("frozen arcade personalities and captain leadership", () => {
  it("requires supported personality rules with morale and matching team opt-ins", () => {
    for (const dependency of [
      "moraleVersion",
      "chemistryGrowthVersion",
      "chemistryVersion",
    ] as const) {
      const invalid = setup();
      delete invalid[dependency];
      expect(() => createGame(invalid)).toThrow();
    }
    expect(() =>
      createGame({
        ...setup(),
        personalityVersion: 2,
      } as unknown as ArcadeSetup),
    ).toThrow();
    const mixed = setup();
    delete mixed.teams[1].personalityVersion;
    expect(() => createGame(mixed)).toThrow();
    delete mixed.teams[0].personalityVersion;
    expect(createGame(mixed).personalityVersion).toBe(1);
    (mixed.teams[0] as { personalityVersion?: number }).personalityVersion = 2;
    expect(() => createGame(mixed)).toThrow();
  });

  it("uses the court version as authority even when both team flags are absent", () => {
    const explicit = setup();
    const implicit = structuredClone(explicit);
    for (const team of implicit.teams) delete team.personalityVersion;
    const state = createGame(explicit);
    expect(state.personalityVersion).toBe(1);
    expect(state.chemistryContexts![0].leadership).toBeDefined();
    expect(state).toEqual(createGame(implicit));
    expect(state.seed).toBe(42);
  });

  it("ignores team personalities when the court version is absent, including role evaluation", () => {
    const source = setup();
    delete source.personalityVersion;
    const legacy = structuredClone(source);
    for (const team of legacy.teams) delete team.personalityVersion;
    const state = createGame(source);
    expect(state).toEqual(createGame(legacy));
    expect(state).not.toHaveProperty("personalityVersion");
    for (const context of state.chemistryContexts!)
      expect(context).not.toHaveProperty("leadership");
  });

  it("keeps a bench captain appointed and applies bounded chemistry only after that captain enters", () => {
    const source = setup();
    const appointed = createGame(source).chemistryContexts![0].leadership;
    expect(appointed).toBeDefined();
    if (!appointed) return;
    moveToSlot(source, appointed.captainId, "B1");
    const state = createGame(source);
    const captain = state.players.find(
      (p) => p.pokemonId === appointed.captainId,
    )!;
    expect(captain.active).toBe(false);
    expect(state.chemistryContexts![0].leadership).toEqual(appointed);
    const before = arcadeLineupChemistry(state, 0)!;
    expect(before.leadership).toEqual({
      captainId: appointed.captainId,
      style: appointed.style,
      active: false,
      cohesionDelta: 0,
    });
    expect(before.score).toBe(withoutLeadership(state).score);
    state.phase = "live";
    stepGame(state, NO_INPUT);
    expect(
      Object.keys(state.chemistryMinutes!.home).some((key) =>
        key.split(":").includes(String(captain.pokemonId)),
      ),
    ).toBe(false);
    state.phase = "break";
    expect(queueSubstitution(state, 0, captain.id)).toBe(true);
    continuePeriod(state);
    const active = arcadeLineupChemistry(state, 0)!;
    expect(active.leadership).toEqual({
      captainId: appointed.captainId,
      style: appointed.style,
      active: true,
      cohesionDelta: appointed.cohesionBonus,
    });
    expect(Math.abs(active.leadership!.cohesionDelta)).toBeLessThanOrEqual(2);
    expect(Math.abs(active.leadership!.cohesionDelta)).toBeGreaterThan(0);
    expect(active.score - withoutLeadership(state).score).toBeCloseTo(
      appointed.cohesionBonus,
    );
    state.phase = "break";
    expect(queueSubstitution(state, captain.id, 0)).toBe(true);
    continuePeriod(state);
    expect(arcadeLineupChemistry(state, 0)!.leadership!.active).toBe(false);
    expect(state.chemistryContexts![0].leadership).toEqual(appointed);
  });

  it("freezes full pregame captain inputs and ignores archived off-roster bonds", () => {
    const source = setup();
    const original = structuredClone(source);
    const state = createGame(source);
    expect(state.chemistryContexts![0].leadership).toBeDefined();
    expect(source).toEqual(original);
    const current = structuredClone(source);
    delete current.teams[0].chemistryBonds!["1:2"];
    expect(state).toEqual(createGame(current));
    const contexts = structuredClone(state.chemistryContexts);
    const morale = structuredClone(state.moraleInitial);
    const attributes = state.players.map((p) => ({ ...p.attributes }));
    source.teams[0].coach!.id = "misty";
    source.teams[0].development![7]!.composure = -8;
    source.teams[0].morale![7].score = 0;
    source.teams[0].morale![7].games = 0;
    source.teams[0].chemistryBonds!["7:8"] = 0;
    moveToSlot(source, 7, "PG");
    state.phase = "live";
    for (let tick = 0; tick < 250; tick++) stepGame(state, NO_INPUT);
    expect(state.chemistryContexts).toEqual(contexts);
    expect(state.moraleInitial).toEqual(morale);
    expect(state.players.map((p) => p.attributes)).toEqual(attributes);
    const legacy = structuredClone(original);
    delete legacy.personalityVersion;
    expect(createGame(legacy).players.map((p) => p.attributes)).toEqual(
      attributes,
    );
  });

  it("replays captain-enabled play exactly after JSON serialization", () => {
    const first = createGame(setup());
    expect(first.personalityVersion).toBe(1);
    const restored: ArcadeState = JSON.parse(JSON.stringify(first));
    for (let tick = 0; tick < 400; tick++) {
      const input = {
        ...NO_INPUT,
        moveX: tick % 60 < 30 ? 1 : -1,
        shoot: tick % 70 < 38,
        pass: tick % 90 === 0,
      };
      stepGame(first, input);
      stepGame(restored, input);
    }
    expect(first).toEqual(restored);
  });
});
