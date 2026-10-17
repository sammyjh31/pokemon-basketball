import { describe, expect, it } from "vitest";
import { ROOKIE_POKEMON } from "../data/pokemon";
import { teamRatings } from "./ratings";
import {
  advanceRookieDraft,
  beginRookieDraft,
  generationForDraft,
  recommendedRookiePick,
  rookieProspects,
  selectRookie,
} from "./rookieDraft";
import type { RookieDraft } from "./rookieDraftTypes";
import { rookieFixture } from "./rookieDraft.testUtils";

describe("generational rookie drafts", () => {
  it("upgrades a processed legacy franchise before adding draft records", () => {
    const state = rookieFixture();
    state.franchise!.modelVersion = 2;
    const next = beginRookieDraft(state);
    expect(next.franchise!.modelVersion).toBe(3);
    expect(next.franchise!.history).toBe(state.franchise!.history);
    expect(next.franchise!.rookieDrafts?.[0].generation).toBe(3);
  });

  it("opens only after offseason development and freezes worst-record order with point-difference and club-id ties", () => {
    const state = rookieFixture(),
      f = state.franchise!;
    f.history[0].standings[0].wins = 40;
    f.history[0].standings[1].wins = 40;
    f.history[0].standings[2].wins = 40;
    f.history[0].standings[1].pointsAgainst = 8300;
    const unprocessed = { ...state, franchise: { ...f, offseasons: [] } };
    expect(beginRookieDraft(unprocessed)).toBe(unprocessed);
    const active = { ...state, franchise: { ...f, phase: "season" as const } };
    expect(beginRookieDraft(active)).toBe(active);
    const next = beginRookieDraft(state),
      draft = next.franchise!.rookieDrafts![0];
    expect(draft.generation).toBe(3);
    expect(draft.order.slice(0, 3)).toEqual([3, 4, 5]);
    expect(draft.order.filter((id) => id < 3)).toEqual([1, 0, 2]);
    expect(draft.order[draft.picks.length % 30]).toBe(0);
    expect(draft.tradeIndex).toBe(0);
    expect(beginRookieDraft(next)).toBe(next);
  });

  it("replaces one owned player, preserves slot minutes and retained development, and leaves finished season and careers frozen", () => {
    const original = rookieFixture(),
      f = original.franchise!,
      user = f.teams[0];
    user.development = Object.fromEntries(
      Object.values(user.roster).map((id) => [id!, { threePoint: 4 }]),
    );
    user.rotationPlan = {
      minutes: {
        PG: 35,
        SG: 35,
        SF: 35,
        PF: 35,
        C: 35,
        B1: 25,
        B2: 20,
        B3: 20,
      },
      closing: ["PG", "SG", "SF", "PF", "C"],
    };
    f.trainingPlans = {
      129: { focus: "shooting", intensity: "standard" },
      25: { focus: "defense", intensity: "standard" },
    };
    const snapshot = structuredClone(original),
      started = beginRookieDraft(original),
      next = selectRookie(started, 252, 129),
      result = next.franchise!;
    expect(result.teams[0].roster.PG).toBe(252);
    expect(result.teams[0].development?.[129]).toBeUndefined();
    expect(result.teams[0].development?.[252]).toEqual({});
    expect(result.teams[0].development?.[25]).toEqual({ threePoint: 4 });
    expect(result.teams[0].rotationPlan).toEqual(user.rotationPlan);
    expect(result.teams[0].ratings).toEqual(
      teamRatings(
        result.teams[0].roster,
        user.tactic,
        user.rotation,
        result.teams[0].development,
        user.rotationPlan,
      ),
    );
    expect(result.trainingPlans).toEqual({
      25: { focus: "defense", intensity: "standard" },
    });
    expect(result.rookieDrafts![0].picks[0]).toEqual({
      pick: 1,
      round: 1,
      teamId: 0,
      pokemonId: 252,
      releasedId: 129,
    });
    expect(result.rookieDrafts![0].picks).toHaveLength(30);
    expect(next.run).toBe(original.run);
    expect(result.history).toBe(f.history);
    expect(result.careers).toBe(f.careers);
    expect(original).toEqual(snapshot);
  });

  it("rejects invalid, duplicate, stale, wrong-generation and non-owned selections", () => {
    const start = beginRookieDraft(rookieFixture());
    for (const [pick, release] of [
      [252, 1],
      [1, 129],
      [387, 129],
      [382, 129],
      [NaN, 129],
    ])
      expect(selectRookie(start, pick, release)).toBe(start);
    const next = selectRookie(start, 252, 129);
    expect(selectRookie(next, 252, 25)).toBe(next);
    expect(selectRookie(next, 253, 129)).toBe(next);
    const cpuTurn = structuredClone(start);
    cpuTurn.franchise!.rookieDrafts![0].order.reverse();
    expect(selectRookie(cpuTurn, 252, 129)).toBe(cpuTurn);
  });

  it("finishes sixty unique, deterministic picks in two rounds with thirty eight-player clubs", () => {
    function complete() {
      let state = beginRookieDraft(rookieFixture());
      for (let round = 0; round < 2; round++) {
        const pick = recommendedRookiePick(state.franchise!, 0, false)!;
        expect(pick).not.toBeNull();
        state = selectRookie(state, pick.pokemonId, pick.releasedId);
      }
      return state;
    }
    const state = complete(),
      f = state.franchise!,
      draft = f.rookieDrafts![0];
    expect(draft.complete).toBe(true);
    expect(draft.picks).toHaveLength(60);
    expect(new Set(draft.picks.map((pick) => pick.pokemonId)).size).toBe(60);
    expect(draft.picks.slice(0, 30).map((pick) => pick.teamId)).toEqual(
      draft.order,
    );
    expect(draft.picks.slice(30).map((pick) => pick.teamId)).toEqual(
      draft.order,
    );
    expect(draft.picks.slice(30).every((pick) => pick.round === 2)).toBe(true);
    expect(f.teams).toHaveLength(30);
    expect(
      new Set(f.teams.flatMap((team) => Object.values(team.roster))).size,
    ).toBe(240);
    expect(
      f.teams.every((team) => Object.values(team.roster).length === 8),
    ).toBe(true);
    expect(
      f.teams.every((team) => Object.keys(team.development ?? {}).length === 8),
    ).toBe(true);
    expect(complete()).toEqual(state);
    expect(advanceRookieDraft(state)).toBe(state);
    expect(selectRookie(state, 253, 25)).toBe(state);
  });

  it("introduces Gen III at any franchise age, then each bundled generation before the remaining pool", () => {
    const state = rookieFixture(),
      f = state.franchise!;
    f.year = 5;
    f.history = Array.from({ length: 5 }, (_, index) => ({
      ...f.history[0],
      year: index + 1,
    }));
    f.offseasons![0].year = 5;
    expect(beginRookieDraft(state).franchise!.rookieDrafts![0].generation).toBe(
      3,
    );
    expect(
      Array.from({ length: 9 }, (_, index) => generationForDraft(index)),
    ).toEqual([3, 4, 5, 6, 7, 8, 9, 0, 0]);
    expect(
      rookieProspects(f, true).every((mon) => mon.id >= 252 && mon.id <= 386),
    ).toBe(true);
    f.rookieDrafts = [
      {
        modelVersion: 1,
        year: 4,
        generation: 3,
        order: Array.from({ length: 30 }, (_, i) => i),
        picks: [],
        complete: true,
        tradeIndex: 0,
      },
    ];
    expect(rookieProspects(f, true).map((mon) => mon.id)).toEqual(
      Array.from({ length: 107 }, (_, index) => 387 + index),
    );
  });

  it("never redrafts a released rookie or any species that has appeared in a prior roster", () => {
    const f = rookieFixture().franchise!;
    f.rookieDrafts = Array.from({ length: 7 }, (_, index): RookieDraft => ({
      modelVersion: 1,
      year: index + 1,
      generation: index + 3,
      order: Array.from({ length: 30 }, (_, i) => i),
      picks:
        index === 0
          ? [{ pick: 1, round: 1, teamId: 0, pokemonId: 252, releasedId: 129 }]
          : [],
      complete: true,
      tradeIndex: 0,
    }));
    f.year = 8;
    f.history[0].rosters[0][0] = 253;
    const prospects = rookieProspects(f, true);
    expect(prospects.some((mon) => mon.id === 252 || mon.id === 253)).toBe(
      false,
    );
    expect(prospects.some((mon) => mon.id === 254)).toBe(true);
    expect(prospects.some((mon) => mon.id === 1025)).toBe(true);
  });

  it("marks an exhausted class complete so a user pick with no prospects cannot trap the offseason", () => {
    const state = rookieFixture(),
      f = state.franchise!;
    f.history[0].rosters.push(
      ROOKIE_POKEMON.filter((mon) => mon.generation === 3).map((mon) => mon.id),
    );
    const next = beginRookieDraft(state);
    expect(next.franchise!.rookieDrafts![0]).toMatchObject({
      complete: true,
      exhausted: true,
      picks: [],
    });
    expect(recommendedRookiePick(next.franchise!, 0, false)).toBeNull();
  });

  it("uses ability and the vacant position to strengthen a weak center", () => {
    const state = rookieFixture(),
      f = state.franchise!,
      user = f.teams[0];
    user.roster.PG = 143;
    user.roster.C = 129;
    user.ratings = teamRatings(user.roster, user.tactic, user.rotation);
    f.history[0].rosters.push(
      ROOKIE_POKEMON.filter(
        (mon) => mon.generation === 3 && mon.id !== 252 && mon.id !== 289,
      ).map((mon) => mon.id),
    );
    expect(recommendedRookiePick(f, 0, false)).toEqual({
      pokemonId: 289,
      releasedId: 129,
      score: expect.any(Number),
    });
  });

  it("records the final available rookie and skips the remaining picks without changing roster size", () => {
    const state = rookieFixture(),
      f = state.franchise!;
    f.history[0].rosters.push(
      ROOKIE_POKEMON.filter(
        (mon) => mon.generation === 3 && mon.id !== 252,
      ).map((mon) => mon.id),
    );
    const next = selectRookie(beginRookieDraft(state), 252, 129);
    expect(next.franchise!.rookieDrafts![0]).toMatchObject({
      complete: true,
      exhausted: true,
    });
    expect(next.franchise!.rookieDrafts![0].picks).toHaveLength(1);
    expect(
      new Set(
        next.franchise!.teams.flatMap((team) => Object.values(team.roster)),
      ).size,
    ).toBe(240);
  });
});
