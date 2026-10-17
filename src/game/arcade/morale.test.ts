import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../../data/pokemon";
import { playerProfile } from "../playerProfile";
import { giveBall, makePass } from "./actions";
import { arcadeLineupChemistry } from "./chemistry";
import { continuePeriod, queueSubstitution, stepGame } from "./engine";
import { createGame } from "./setup";
import { NO_INPUT, type ArcadeSetup } from "./types";

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

function moraleSetup(score = 50): ArcadeSetup {
  const source = setup();
  source.chemistryGrowthVersion = 1;
  source.moraleVersion = 1;
  source.abilityVersion = undefined;
  for (const team of source.teams) {
    team.moraleVersion = 1;
    team.morale = Object.fromEntries(
      Object.values(team.roster).map((id) => [
        id,
        { score, minutes: 30, success: 50, disruption: 0, games: 10 },
      ]),
    );
  }
  return source;
}

describe("frozen arcade player morale", () => {
  it("requires supported versions and matching team opt-ins with earned chemistry", () => {
    expect(() =>
      createGame({ ...moraleSetup(), chemistryGrowthVersion: undefined }),
    ).toThrow();
    expect(() =>
      createGame({ ...moraleSetup(), chemistryVersion: undefined }),
    ).toThrow();
    expect(() =>
      createGame({
        ...moraleSetup(),
        moraleVersion: 2,
      } as unknown as ArcadeSetup),
    ).toThrow();
    const mixed = moraleSetup();
    delete mixed.teams[1].moraleVersion;
    expect(() => createGame(mixed)).toThrow();
    delete mixed.teams[0].moraleVersion;
    expect(createGame(mixed).moraleVersion).toBe(1);
    (mixed.teams[0] as { moraleVersion?: number }).moraleVersion = 2;
    expect(() => createGame(mixed)).toThrow();
  });

  it("rejects malformed roster morale before freezing a new game", () => {
    const missing = moraleSetup();
    delete missing.teams[0].morale![84];
    expect(() => createGame(missing)).toThrow();
    const extra = moraleSetup();
    extra.teams[0].morale![1] = {
      score: 50,
      minutes: 0,
      success: 50,
      disruption: 0,
      games: 0,
    };
    expect(() => createGame(extra)).toThrow();
    for (const score of [NaN, -1, 101]) {
      const invalid = moraleSetup();
      invalid.teams[0].morale![84].score = score;
      expect(() => createGame(invalid)).toThrow();
    }
  });

  it("applies bounded developed execution once and changes real pass flight in both directions", () => {
    const sources = [moraleSetup(0), moraleSetup(50), moraleSetup(100)];
    for (const source of sources)
      source.teams[0].development = { 84: { passing: 7 } };
    const before = structuredClone(sources);
    const raw = structuredClone(
      playerProfile(POKEMON_BY_ID.get(84)!, { passing: 7 }),
    );
    const [low, neutral, high] = sources.map(createGame);
    expect(low.players[0].attributes.passing).toBeCloseTo(
      raw.attributes.passing - 3,
    );
    expect(high.players[0].attributes.passing).toBeCloseTo(
      raw.attributes.passing + 3,
    );
    expect(neutral.players[0].attributes).toEqual(raw.attributes);
    for (const state of [low, neutral, high]) {
      expect(state.players[0].attributes.speed).toBe(raw.attributes.speed);
      expect(state.players[0].attributes.strength).toBe(
        raw.attributes.strength,
      );
      expect(state.players[0].chemistryProfile!.positions).toEqual(
        raw.positions,
      );
      Object.assign(state.players[0], { x: 10, y: 7.5 });
      Object.assign(state.players[1], { x: 20, y: 7.5 });
      giveBall(state, state.players[0]);
      makePass(state, state.players[0], state.players[1]);
      expect(state.seed).toBe(42);
    }
    expect(high.ball.duration).toBeLessThan(neutral.ball.duration);
    expect(low.ball.duration).toBeGreaterThan(neutral.ball.duration);
    expect(sources).toEqual(before);
    expect(playerProfile(POKEMON_BY_ID.get(84)!, { passing: 7 })).toEqual(raw);
  });

  it("uses only the active five's morale and refreshes when a reserve enters", () => {
    const source = moraleSetup(100);
    for (const id of [7, 8, 9]) source.teams[0].morale![id].score = 0;
    const state = createGame(source);
    expect(arcadeLineupChemistry(state, 0)!.morale).toEqual({
      score: 100,
      cohesionDelta: 4,
    });
    state.phase = "break";
    expect(queueSubstitution(state, 0, 5)).toBe(true);
    continuePeriod(state);
    expect(arcadeLineupChemistry(state, 0)!.morale!.score).toBe(80);
    expect(arcadeLineupChemistry(state, 0)!.morale!.cohesionDelta).toBeCloseTo(
      2.4,
    );
    expect(arcadeLineupChemistry(state, 0)!.effects).not.toHaveProperty("84");
    expect(arcadeLineupChemistry(state, 0)!.effects).toHaveProperty("7");
  });

  it("captures sorted full pregame state and never evolves morale during live play", () => {
    const source = moraleSetup();
    source.teams[0].morale![7] = {
      score: 75,
      minutes: 22,
      success: 60,
      disruption: -2,
      games: 9,
    };
    const state = createGame(source);
    expect(state.moraleInitial!.home).toHaveLength(40);
    expect(state.moraleInitial!.away).toHaveLength(40);
    expect(state.moraleInitial!.home.slice(0, 5)).toEqual([75, 22, 60, -2, 9]);
    const frozen = structuredClone(state.moraleInitial);
    const scores = structuredClone(
      state.chemistryContexts!.map((context) => context.morale),
    );
    const attributes = state.players.map((p) => ({ ...p.attributes }));
    source.teams[0].morale![7].score = 0;
    source.teams[1].morale![20].score = 100;
    state.phase = "live";
    for (let tick = 0; tick < 250; tick++) stepGame(state, NO_INPUT);
    expect(state.moraleInitial).toEqual(frozen);
    expect(state.chemistryContexts!.map((context) => context.morale)).toEqual(
      scores,
    );
    expect(state.players.map((p) => p.attributes)).toEqual(attributes);
  });

  it("repeats morale-enabled play exactly after JSON serialization", () => {
    const first = createGame(moraleSetup(80));
    const restored = JSON.parse(JSON.stringify(first));
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

  it("ignores team morale when the court version is absent, including role evaluation", () => {
    const source = moraleSetup(100);
    delete source.moraleVersion;
    const legacy = structuredClone(source);
    for (const team of legacy.teams) {
      delete team.moraleVersion;
      delete team.morale;
    }
    const state = createGame(source);
    expect(state).toEqual(createGame(legacy));
    expect(state).not.toHaveProperty("moraleVersion");
    expect(state).not.toHaveProperty("moraleInitial");
    expect(state.chemistryContexts![0]).not.toHaveProperty("morale");
  });

  it("preserves the e8681b9 morale replay exactly without personalities", () => {
    const source = moraleSetup(80);
    source.personalityVersion = undefined;
    for (const team of source.teams) team.personalityVersion = undefined;
    const state = createGame(source);
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
    ).toBe("e1a68a76f29ed9df552e6a57d321c4549027cacdaca6bb1b89ec806083dbd59f");
  });

  it("preserves the historical chemistry replay exactly without morale", () => {
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
    ).toBe("83a49bb6676ab12cfba1af11bfbab5804f9660571a8b8ae90325e814bf16df50");
  });
});
