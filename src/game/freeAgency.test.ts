import { describe, expect, it } from "vitest";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import { rookieFixture } from "./rookieDraft.testUtils";
import {
  freeAgentMarket,
  freeAgencyReady,
  processCpuFreeAgency,
  signFreeAgent,
} from "./freeAgency";
import { ROSTER_SLOTS } from "./types";

function drafted() {
  let state = beginRookieDraft(rookieFixture());
  while (!state.franchise!.rookieDrafts!.at(-1)!.complete) {
    const choice = recommendedRookiePick(state.franchise!, 0, false)!;
    state = selectRookie(state, choice.pokemonId, choice.releasedId);
  }
  return state;
}

describe("franchise free agency", () => {
  it("records an empty CPU round once when no released players are available", () => {
    const state = drafted();
    state.franchise!.rookieDrafts![0].picks = [];
    expect(freeAgentMarket(state.franchise!)).toHaveLength(0);
    const next = processCpuFreeAgency(state);
    expect(next.franchise!.freeAgency).toEqual({
      modelVersion: 1,
      transactions: [],
      cpuYears: [1],
    });
    expect(next.franchise!.teams).toBe(state.franchise!.teams);
    expect(processCpuFreeAgency(next)).toBe(next);
  });
  it("lists only released and currently unowned players, including old-save drafts", () => {
    const state = drafted(),
      f = state.franchise!;
    const pool = freeAgentMarket(f, false);
    expect(pool).toHaveLength(60);
    const released = f.rookieDrafts![0].picks.map((p) => p.releasedId);
    expect(pool.every((p) => released.includes(p.pokemonId))).toBe(true);
    expect(
      pool.some((p) => Object.values(f.teams[0].roster).includes(p.pokemonId)),
    ).toBe(false);
    expect(pool.some((p) => p.pokemonId === 1025)).toBe(false);
    expect(f.freeAgency).toBeUndefined();
    expect(freeAgencyReady(f)).toBe(true);
  });

  it("replaces exactly one player while preserving minutes, history and developed skills", () => {
    const state = drafted(),
      f = state.franchise!;
    const incoming = f.rookieDrafts![0].picks[0].releasedId;
    f.offseasons![0].players.push({
      pokemonId: incoming,
      teamId: 0,
      before: 40,
      after: 45,
      minutesPerGame: 12,
      impactPer36: 8,
      changes: { threePoint: 7, passing: -2 },
      outcome: "growth",
      reasons: ["Training"],
    });
    const outgoing = f.teams[0].roster.B3!;
    f.trainingPlans = {
      [outgoing]: { focus: "defense", intensity: "standard" },
    };
    f.teams[0].rotationPlan = {
      minutes: {
        PG: 35,
        SG: 35,
        SF: 35,
        PF: 35,
        C: 35,
        B1: 25,
        B2: 25,
        B3: 15,
      },
      closing: ["PG", "SG", "SF", "PF", "C"],
    };
    const before = structuredClone(state);
    const next = signFreeAgent(state, incoming, outgoing);
    expect(next).not.toBe(state);
    expect(state).toEqual(before);
    expect(next.run).toBe(state.run);
    expect(next.franchise!.history).toBe(f.history);
    expect(next.franchise!.careers).toBe(f.careers);
    expect(next.franchise!.teams[0].roster.B3).toBe(incoming);
    expect(next.franchise!.teams[0].development?.[incoming]).toEqual({
      threePoint: 7,
      passing: -2,
    });
    expect(next.franchise!.teams[0].development?.[outgoing]).toBeUndefined();
    expect(next.franchise!.teams[0].rotationPlan).toEqual(
      f.teams[0].rotationPlan,
    );
    expect(next.franchise!.trainingPlans?.[outgoing]).toBeUndefined();
    expect(
      new Set(next.franchise!.teams.flatMap((t) => Object.values(t.roster)))
        .size,
    ).toBe(240);
    expect(
      freeAgentMarket(next.franchise!, false).map((p) => p.pokemonId),
    ).toContain(outgoing);
    expect(
      freeAgentMarket(next.franchise!, false).map((p) => p.pokemonId),
    ).not.toContain(incoming);
    expect(signFreeAgent(next, incoming, outgoing)).toBe(next);
  });

  it("rejects in-season, pre-draft, owned, undrafted and wrong-release signings", () => {
    const state = drafted(),
      f = state.franchise!,
      incoming = freeAgentMarket(f, false)[0]?.pokemonId ?? 129;
    const outgoing = f.teams[0].roster.B3!;
    expect(
      signFreeAgent(rookieFixture(), incoming, outgoing).franchise?.freeAgency,
    ).toBeUndefined();
    const season = { ...state, franchise: { ...f, phase: "season" as const } };
    expect(signFreeAgent(season, incoming, outgoing)).toBe(season);
    expect(signFreeAgent(state, f.teams[1].roster.PG!, outgoing)).toBe(state);
    expect(signFreeAgent(state, 1025, outgoing)).toBe(state);
    expect(signFreeAgent(state, incoming, f.teams[1].roster.PG!)).toBe(state);
  });

  it("runs CPU upgrades once, protects drafted rookies, and never changes the user's team", () => {
    const state = drafted(),
      f = state.franchise!;
    // Deliberately release a strong player, making a real upgrade available.
    const incoming = freeAgentMarket(f, false)[0]?.pokemonId ?? 129;
    const next = signFreeAgent(state, incoming, 149);
    expect(next).not.toBe(state);
    const result = processCpuFreeAgency(next);
    expect(result.franchise!.freeAgency!.cpuYears).toEqual([1]);
    expect(result.franchise!.teams[0]).toEqual(next.franchise!.teams[0]);
    const cpu = result.franchise!.freeAgency!.transactions.filter(
      (t) => t.source === "cpu",
    );
    expect(cpu.length).toBeGreaterThan(0);
    expect(new Set(cpu.map((t) => t.teamId)).size).toBe(cpu.length);
    const rookies = new Set(f.rookieDrafts![0].picks.map((p) => p.pokemonId));
    expect(cpu.every((t) => t.teamId > 0 && !rookies.has(t.releasedId))).toBe(
      true,
    );
    expect(
      result.franchise!.teams.every(
        (t) => ROSTER_SLOTS.filter((s) => t.roster[s] != null).length === 8,
      ),
    ).toBe(true);
    expect(
      new Set(result.franchise!.teams.flatMap((t) => Object.values(t.roster)))
        .size,
    ).toBe(240);
    expect(processCpuFreeAgency(result)).toBe(result);
    expect(processCpuFreeAgency(next)).toEqual(result);
  });
});
