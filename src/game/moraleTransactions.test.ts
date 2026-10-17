import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { exchangePackage, exchangePlayers } from "./rosterTrades";
import { retainMorale, validateMoraleRoster } from "./playerMorale";
import { rookieFixture } from "./rookieDraft.testUtils";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import {
  freeAgentMarket,
  signFreeAgent,
  processCpuFreeAgency,
} from "./freeAgency";
const teams = () =>
  createLeague({
    ...createRun("free", true, 973),
    personalityVersion: undefined,
    roster: {
      PG: 65,
      SG: 135,
      SF: 149,
      PF: 68,
      C: 143,
      B1: 121,
      B2: 6,
      B3: 131,
    },
  });
it("keeps donor morale with each species in simultaneous packages, without changing source or discarded records", () => {
  const source = teams();
  const give = Object.values(source[0].roster).slice(0, 3) as number[],
    receive = Object.values(source[1].roster).slice(0, 3) as number[];
  for (const id of give)
    source[0].morale![id] = {
      score: 75,
      minutes: 34,
      success: 70,
      disruption: 0,
      games: 82,
    };
  for (const id of receive)
    source[1].morale![id] = {
      score: 30,
      minutes: 12,
      success: 30,
      disruption: -1,
      games: 70,
    };
  const original = JSON.stringify(source);
  for (const count of [1, 2, 3]) {
    const next = exchangePackage(
      source,
      0,
      1,
      give.slice(0, count),
      receive.slice(0, count),
    );
    expect(next).not.toBe(source);
    for (const id of give.slice(0, count)) {
      expect(next[1].morale![id].score).toBe(71);
      expect(next[1].morale![id].games).toBe(82);
      expect(next[0].morale![id]).toBeUndefined();
    }
    for (const id of receive.slice(0, count)) {
      expect(next[0].morale![id].score).toBe(26);
      expect(next[0].morale![id].disruption).toBe(-7);
    }
    for (const t of next)
      expect(() => validateMoraleRoster(t.morale, t)).not.toThrow();
  }
  const legacySwap = exchangePlayers(source, 0, 1, give[0], receive[0]);
  expect(legacySwap[1].morale![give[0]].score).toBe(71);
  expect(JSON.stringify(source)).toBe(original);
});
it("initializes rookies and replacement free agents without inheriting released player morale; CPU signings keep valid states", () => {
  let state = rookieFixture();
  state.franchise!.teams = state.franchise!.teams.map((t) =>
    retainMorale({
      ...t,
      chemistryVersion: 1 as const,
      chemistryGrowthVersion: 1 as const,
      chemistryBonds: {},
    }),
  );
  const first = state.franchise!.teams[0];
  for (const p of Object.values(first.morale!)) p.score = 80;
  state = beginRookieDraft(state);
  while (!state.franchise!.rookieDrafts!.at(-1)!.complete) {
    const choice = recommendedRookiePick(state.franchise!, 0, false)!;
    state = selectRookie(state, choice.pokemonId, choice.releasedId);
  }
  const drafted = state.franchise!.rookieDrafts!.at(-1)!;
  for (const pick of drafted.picks) {
    const t = state.franchise!.teams[pick.teamId];
    if (Object.values(t.roster).includes(pick.pokemonId)) {
      expect(t.morale![pick.pokemonId].games).toBe(0);
      expect(t.morale![pick.pokemonId].score).toBeLessThanOrEqual(50);
    }
    expect(t.morale![pick.releasedId]).toBeUndefined();
  }
  const incoming = freeAgentMarket(state.franchise!, false)[0].pokemonId,
    outgoing = state.franchise!.teams[0].roster.B3!;
  const signed = signFreeAgent(state, incoming, outgoing);
  expect(signed).not.toBe(state);
  expect(signed.franchise!.teams[0].morale![incoming]).toEqual({
    score: 50,
    minutes: 0,
    success: 50,
    disruption: -2,
    games: 0,
  });
  expect(signed.franchise!.teams[0].morale![outgoing]).toBeUndefined();
  const processed = processCpuFreeAgency(signed);
  for (const t of processed.franchise!.teams)
    expect(() => validateMoraleRoster(t.morale, t)).not.toThrow();
  expect(
    new Set(processed.franchise!.teams.flatMap((t) => Object.values(t.roster)))
      .size,
  ).toBe(240);
});
