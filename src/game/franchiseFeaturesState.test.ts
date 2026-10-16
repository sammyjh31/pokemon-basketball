import { describe, expect, it } from "vitest";
import { initialState, gameReducer } from "./state";
import { createRun } from "./draft";
import { createLeague } from "./league";
import type { GameState } from "./types";
import type { RotationPlan } from "./franchiseFeatures";
const plan: RotationPlan = {
  minutes: { PG: 36, SG: 36, SF: 36, PF: 36, C: 36, B1: 20, B2: 20, B3: 20 },
  closing: ["PG", "SG", "SF", "PF", "B1"],
};
const fixture = (): GameState => {
  const run = {
    ...createRun("free", true, 47),
    roster: { PG: 65, SG: 150, SF: 149, PF: 68, C: 143, B1: 9, B2: 94, B3: 59 },
  };
  const teams = createLeague(run);
  return {
    ...initialState(47),
    run: { ...run, leagueTeams: teams },
    franchise: {
      modelVersion: 2,
      year: 1,
      phase: "season",
      teams,
      careers: [],
      history: [],
      trades: [],
    },
  };
};
describe("franchise coaching and progression actions", () => {
  it("saves valid minutes, rejects invalid allocations, and locks coaching after tipoff", () => {
    const state = fixture();
    const ready = gameReducer(state, { type: "ROTATION_PLAN", plan });
    expect(ready.run.rotationPlan).toEqual(plan);
    expect(
      gameReducer(ready, {
        type: "ROTATION_PLAN",
        plan: { ...plan, minutes: { ...plan.minutes, B1: 21 } },
      }),
    ).toBe(ready);
    const live = {
      ...ready,
      run: {
        ...ready.run,
        seasonProgress: {
          modelVersion: 1 as const,
          completedRounds: 1,
          playedGames: {},
        },
      },
    };
    expect(gameReducer(live, { type: "ROTATION_PLAN", plan: undefined })).toBe(
      live,
    );
    expect(gameReducer(live, { type: "SWAP", first: "PG", second: "B1" })).toBe(
      live,
    );
    expect(gameReducer(live, { type: "TACTIC", tactic: "pace" })).toBe(live);
  });
  it("saves training during a season but rejects plans for another team's player", () => {
    const state = fixture(),
      plans = {
        65: { focus: "shooting" as const, intensity: "aggressive" as const },
      };
    const after = gameReducer(state, { type: "TRAINING_PLANS", plans });
    expect(after.franchise!.trainingPlans).toEqual(plans);
    const outsider = Object.values(state.franchise!.teams[1].roster)[0]!;
    expect(
      gameReducer(after, {
        type: "TRAINING_PLANS",
        plans: { [outsider]: plans[65] },
      }),
    ).toBe(after);
  });
  it("rejects stale and duplicate completed round actions without changing challenge records", () => {
    const state = fixture();
    const next = {
      ...state.run,
      seasonProgress: {
        modelVersion: 1 as const,
        completedRounds: 1,
        playedGames: {},
      },
    };
    const after = gameReducer(state, {
      type: "APPLY_FRANCHISE_RUN",
      source: state.run,
      run: next,
    });
    expect(after.run).toBe(next);
    expect(after.records).toBe(state.records);
    expect(
      gameReducer(after, {
        type: "APPLY_FRANCHISE_RUN",
        source: state.run,
        run: next,
      }),
    ).toBe(after);
    expect(
      gameReducer(after, {
        type: "APPLY_FRANCHISE_RUN",
        source: next,
        run: next,
      }),
    ).toBe(after);
  });
});
