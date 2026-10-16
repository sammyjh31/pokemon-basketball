import { describe, it, expect } from "vitest";
import { validateLeagueTeams } from "./franchiseValidation";
import { createLeague } from "./league";
import { createRun } from "./draft";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";

function fixture(): GameState {
  const run = {
    ...createRun("free", true, 47),
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
    ) as GameState["run"]["roster"],
  };
  const teams = createLeague(run);
  return {
    ...initialState(47),
    run,
    franchise: {
      modelVersion: 3,
      year: 1,
      phase: "offseason",
      teams,
      history: [],
      careers: [],
      trades: [],
    },
  };
}
const plan = {
  minutes: { PG: 36, SG: 36, SF: 36, PF: 36, C: 36, B1: 20, B2: 20, B3: 20 },
  closing: ["PG", "SG", "SF", "PF", "B1"],
};
describe("offseason roster management", () => {
  it("allows roster moves for later-generation franchise players", () => {
    const state = fixture(),
      user = state.franchise!.teams[0];
    user.roster.PG = 252;
    const next = gameReducer(state, {
      type: "OFFSEASON_ROSTER",
      settings: {
        roster: { ...user.roster, PG: user.roster.B1, B1: 252 },
        tactic: user.tactic,
        defense: user.defense,
        rotation: user.rotation,
      },
    });
    expect(next).not.toBe(state);
    expect(next.franchise!.teams[0].roster.B1).toBe(252);
  });
  it("changes starters, coaching and minutes without editing the finished run or another club", () => {
    const state = fixture(),
      user = state.franchise!.teams[0];
    const roster = { ...user.roster, PG: user.roster.B1, B1: user.roster.PG };
    const next = gameReducer(state, {
      type: "OFFSEASON_ROSTER",
      settings: {
        roster,
        tactic: "perimeter",
        defense: "zone",
        rotation: "bench",
        rotationPlan: plan,
      },
    } as never);
    expect(next.franchise!.teams[0].roster.PG).toBe(9);
    expect(next.franchise!.teams[0].roster.B1).toBe(65);
    expect(next.franchise!.teams[0]).toMatchObject({
      tactic: "perimeter",
      defense: "zone",
      rotation: "bench",
      rotationPlan: plan,
    });
    expect(next.run).toBe(state.run);
    expect(next.franchise!.history).toBe(state.franchise!.history);
    expect(next.franchise!.teams[1]).toBe(state.franchise!.teams[1]);
    expect(state.franchise!.teams[0].roster.PG).toBe(65);
  });
  it("keeps automatic rotations valid after changing coaching or clearing a custom plan", () => {
    let state = fixture();
    const user = state.franchise!.teams[0];
    for (const rotationPlan of [undefined, plan, undefined]) {
      state = gameReducer(state, {
        type: "OFFSEASON_ROSTER",
        settings: {
          roster: user.roster,
          tactic: "pace",
          defense: "press",
          rotation: "starters",
          rotationPlan,
        },
      } as never);
      expect(() =>
        validateLeagueTeams(state.franchise!.teams, true),
      ).not.toThrow();
    }
    expect(state.franchise!.teams[0]).not.toHaveProperty("rotationPlan");
  });
  it("rejects duplicates, outsiders, invalid coaching/minutes, and in-season edits", () => {
    const state = fixture(),
      user = state.franchise!.teams[0];
    const settings = {
      roster: user.roster,
      tactic: user.tactic,
      defense: user.defense,
      rotation: user.rotation,
    };
    const invalid = [
      { ...settings, roster: { ...user.roster, PG: user.roster.SG } },
      {
        ...settings,
        roster: { ...user.roster, PG: state.franchise!.teams[1].roster.PG },
      },
      { ...settings, tactic: "bad" },
      {
        ...settings,
        rotationPlan: { ...plan, minutes: { ...plan.minutes, PG: 48 } },
      },
    ];
    for (const value of invalid)
      expect(
        gameReducer(state, {
          type: "OFFSEASON_ROSTER",
          settings: value,
        } as never),
      ).toBe(state);
    const live = {
      ...state,
      franchise: { ...state.franchise!, phase: "season" as const },
    };
    expect(
      gameReducer(live, { type: "OFFSEASON_ROSTER", settings } as never),
    ).toBe(live);
  });
});
