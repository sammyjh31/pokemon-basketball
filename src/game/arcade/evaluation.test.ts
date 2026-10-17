import { describe, expect, it } from "vitest";
import { createEvaluationContext, evaluatePlayer } from "../teamEvaluation";
import { clamp } from "../ratings";
import { POSITIONS } from "../types";
import { chooseCpuSubstitution } from "./coaching";
import { continuePeriod } from "./engine";
import { activePlayers } from "./helpers";
import { createGame } from "./setup";
import type { ArcadeSetup } from "./types";

const setup = (): ArcadeSetup => ({
  seed: 42,
  teams: [
    {
      name: "Human",
      roster: { PG: 7, SG: 8, SF: 9, PF: 54, C: 55, B1: 27, B2: 28, B3: 50 },
    },
    {
      name: "CPU",
      roster: {
        PG: 52,
        SG: 53,
        SF: 108,
        PF: 113,
        C: 143,
        B1: 25,
        B2: 134,
        B3: 126,
      },
      tactic: "perimeter",
      defense: "press",
      coach: { version: 1, id: "misty" },
      development: { 25: { passing: 20, threePoint: 15 } },
      abilityVersion: 1,
      engineRules: { abilities: false },
    },
  ],
});

describe("shared arcade evaluation", () => {
  it("changes a real coached substitution from raw position strength to shared team value", () => {
    const source = setup();
    source.typeMatchupsVersion = 1;
    source.teams[1] = {
      name: "CPU",
      roster: {
        PG: 113,
        SG: 133,
        SF: 115,
        PF: 137,
        C: 20,
        B1: 128,
        B2: 53,
        B3: 108,
      },
      tactic: "perimeter",
      defense: "press",
      coach: { version: 1, id: "misty" },
    };
    // All opponents are Water and every CPU species is Normal, isolating team value.
    const legacy = createGame(source);
    const modern = createGame({ ...source, evaluationVersion: 1 });
    expect(chooseCpuSubstitution(legacy)).toEqual({ outId: 12, inId: 13 });
    expect(chooseCpuSubstitution(modern)).toEqual({ outId: 8, inId: 14 });
    modern.phase = "break";
    continuePeriod(modern);
    expect(modern.players[14].slot).toBe("PG");
    expect(modern.players[14].active).toBe(true);
  });

  it("snapshots bounded role scores from each club's coaching, skills and the actual arcade ability rule", () => {
    const source = {
      ...setup(),
      evaluationVersion: 1 as const,
      abilityVersion: 1 as const,
    };
    const state = createGame(source);
    expect(state.evaluationVersion).toBe(1);
    for (const p of state.players) {
      const team = source.teams[p.team];
      const context = createEvaluationContext({
        ...team,
        tactic: team.tactic ?? "balanced",
        abilityVersion: 1,
        engineRules: { abilities: true },
      });
      for (const role of POSITIONS) {
        expect(p.roleScores?.[role]).toBeCloseTo(
          clamp(evaluatePlayer(context, p.pokemonId, role).score),
        );
        expect(p.roleScores?.[role]).toBeGreaterThanOrEqual(0);
        expect(p.roleScores?.[role]).toBeLessThanOrEqual(100);
      }
    }
    const frozen = structuredClone(state);
    source.teams[1].development![25]!.passing = -20;
    source.teams[1].coach = { version: 1, id: "brock" };
    expect(state).toEqual(frozen);
    expect(createGame(source).players[13].roleScores).not.toEqual(
      state.players[13].roleScores,
    );

    const disabled = createGame({ ...source, abilityVersion: undefined });
    const context = createEvaluationContext({
      ...source.teams[1],
      tactic: source.teams[1].tactic!,
      abilityVersion: undefined,
      engineRules: { abilities: false },
    });
    expect(disabled.players[13].roleScores?.PG).toBeCloseTo(
      clamp(evaluatePlayer(context, 25, "PG").score),
    );
    expect(disabled.players[13].roleScores).not.toEqual(
      createGame(source).players[13].roleScores,
    );
  });

  it("uses the outgoing role's shared score at the real dead ball without changing the human lineup or enabling type counters", () => {
    const state = createGame({ ...setup(), evaluationVersion: 1 });
    // Isolate the substitution decision from physics and species type advantages.
    for (const p of state.players) {
      for (const key of Object.keys(
        p.attributes,
      ) as (keyof typeof p.attributes)[])
        p.attributes[key] = 70;
      p.roleScores = { PG: 50, SG: 50, SF: 50, PF: 50, C: 50 };
    }
    expect(chooseCpuSubstitution(state)).toBeUndefined();
    state.players[14].roleScores!.PG = 70;
    state.players[15].roleScores!.C = 90;
    state.phase = "break";
    continuePeriod(state);
    expect(state.players[15].active).toBe(true);
    expect(state.players[15].slot).toBe("C");
    expect(state.players[12].active).toBe(false);
    expect(activePlayers(state, 0).map((p) => p.id)).toEqual([0, 1, 2, 3, 4]);
    expect(chooseCpuSubstitution(state)).toBeUndefined(); // Existing cooldown still applies.
    state.players[15].energy = 0;
    expect(chooseCpuSubstitution(state)?.outId).toBe(15); // Urgent rest still wins.
  });

  it("keeps the exact legacy state shape and fatigue policy when the evaluation flag is absent", () => {
    const source = setup();
    const state = createGame(source);
    const plain = createGame({
      ...source,
      teams: source.teams.map(({ name, roster, development }) => ({
        name,
        roster,
        development,
      })) as ArcadeSetup["teams"],
    });
    expect(state).toEqual(plain);
    expect(state).not.toHaveProperty("evaluationVersion");
    expect(state.players.every((p) => !("roleScores" in p))).toBe(true);
    state.phase = "break";
    continuePeriod(state);
    expect(activePlayers(state, 1).map((p) => p.id)).toEqual([
      8, 9, 10, 11, 12,
    ]);
  });
});
