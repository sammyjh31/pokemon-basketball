import { expect, it } from "vitest";
import {
  addSharedMinutes,
  finishPairMinutes,
  pairKey,
  pairBond,
  validatePairBonds,
  snapshotChemistry,
  applyChemistrySnapshot,
  syncTeamBonds,
  retainChemistry,
  initialChemistryBanks,
  recordChemistryGame,
} from "./teammateChemistry";
import { insightTeams } from "./insightAnalysis.testUtils";
const team = (ids: number[], id = 0) => ({
  ...insightTeams[0],
  id,
  chemistryVersion: 1 as const,
  chemistryGrowthVersion: 1 as const,
  chemistryBonds: {} as Record<string, number>,
  roster: Object.fromEntries(
    ["PG", "SG", "SF", "PF", "C", "B1", "B2", "B3"].map((s, i) => [s, ids[i]]),
  ) as (typeof insightTeams)[0]["roster"],
});
it("credits only ten distinct active pairs and grows with diminishing returns", () => {
  const minutes = {};
  addSharedMinutes(minutes, [1, 2, 3, 4, 5], 12);
  addSharedMinutes(minutes, [1, 2, 3, 4, 6], 3.333333);
  expect(Object.keys(minutes)).toHaveLength(14);
  expect(finishPairMinutes(minutes)["1:2"]).toBe(15.33);
  expect(finishPairMinutes(minutes)["1:5"]).toBe(12);
  expect(finishPairMinutes(minutes)["5:6"]).toBeUndefined();
  expect(pairKey(5, 1)).toBe("1:5");
  expect(pairBond(600)).toBe(0.5);
  expect(pairBond(1200)).toBeLessThan(1);
  expect(() => addSharedMinutes(minutes, [1, 1, 2, 3, 4], 5)).toThrow();
});
it("freezes compact pregame snapshots and rejects malformed banks or contexts", () => {
  const a = team([1, 2, 3, 4, 5, 6, 7, 8]),
    b = team([9, 10, 11, 12, 13, 14, 15, 16], 1);
  a.chemistryBonds = { "1:2": 200 };
  const c = snapshotChemistry(a, b)!;
  expect(c.home).toHaveLength(28);
  a.chemistryBonds["1:2"] = 500;
  expect(applyChemistrySnapshot(a, c.home).chemistryBonds!["1:2"]).toBe(200);
  for (const bank of [
    { "2:1": 4 },
    { "1:1": 4 },
    { "1:2": -1 },
    { "1:2": Infinity },
    { "1:2": 6001 },
    { "1:1026": 5 },
    { "1:2": 1.234 },
  ])
    expect(() => validatePairBonds(bank)).toThrow();
  expect(() => applyChemistrySnapshot(a, [])).toThrow();
  expect(() => applyChemistrySnapshot(a, Array(28).fill(NaN))).toThrow();
});
it("carries moved pairs, remembers reunions and gives rookies no slot history", () => {
  const a = team([1, 2, 3, 4, 5, 6, 7, 8]),
    b = team([9, 10, 11, 12, 13, 14, 15, 16], 1);
  a.chemistryBonds = { "1:2": 1000, "1:3": 500 };
  const moved = syncTeamBonds([
    { ...a, roster: { ...a.roster, PG: 9, SG: 10 } },
    { ...b, roster: { ...b.roster, PG: 1, SG: 2 } },
  ]);
  expect(moved[1].chemistryBonds!["1:2"]).toBe(1000);
  expect(moved[1].chemistryBonds!["1:11"]).toBeUndefined();
  expect(moved[0].chemistryBonds!["1:3"]).toBe(500);
  const rookied = { ...moved[0], roster: { ...moved[0].roster, SF: 252 } };
  expect(
    syncTeamBonds([rookied, moved[1]])[0].chemistryBonds!["9:252"],
  ).toBeUndefined();
  const decayed = retainChemistry(moved[1]);
  expect(decayed.chemistryBonds!["1:2"]).toBe(900);
  expect(moved[1].chemistryBonds!["1:2"]).toBe(1000);
  expect(
    retainChemistry({ ...a, chemistryBonds: { "1:2": 16.15 } }).chemistryBonds[
      "1:2"
    ],
  ).toBe(14.54);
});
it("records a completed fixture into a separate bank without mutating its inputs", () => {
  const a = team([1, 2, 3, 4, 5, 6, 7, 8]),
    b = team([9, 10, 11, 12, 13, 14, 15, 16], 1);
  const banks = initialChemistryBanks([a, b])!;
  const raw = { home: { "1:2": 12 }, away: { "9:10": 8 } };
  recordChemistryGame(banks, a, b, { chemistryMinutes: raw });
  expect(banks[0]["1:2"]).toBe(12);
  expect(a.chemistryBonds).toEqual({});
  expect(raw.home["1:2"]).toBe(12);
});
it("uses pair-specific familiarity in court chemistry and preserves ordinary growth with abilities off", async () => {
  const { evaluateLineupChemistry } = await import("./lineupChemistry");
  const { playerProfile } = await import("./playerProfile");
  const { POKEMON_BY_ID } = await import("../data/pokemon");
  const players = [311, 312, 65, 68, 95].map((pokemonId) => ({
    pokemonId,
    profile: playerProfile(POKEMON_BY_ID.get(pokemonId)!),
  }));
  const ctx = {
    tactic: "balanced" as const,
    defense: "man" as const,
    abilities: true,
  };
  const fresh = evaluateLineupChemistry(players, { ...ctx, bonds: {} }),
    old = evaluateLineupChemistry(players, {
      ...ctx,
      bonds: { "311:312": 1200 },
    });
  expect(old.continuity!.score).toBeGreaterThan(fresh.continuity!.score);
  expect(old.effects[311].passing).toBeGreaterThan(fresh.effects[311].passing);
  expect(old.value).toBeGreaterThan(fresh.value);
  const plain = evaluateLineupChemistry(players, {
    ...ctx,
    abilities: false,
    bonds: { "311:312": 1200 },
  });
  expect(plain.links).toEqual([]);
  expect(plain.score).toBeGreaterThan(plain.skillScore!);
  expect(evaluateLineupChemistry(players, ctx).continuity).toBeUndefined();
  // Real pair memory replaces the older roster-level local setting.
  expect(
    evaluateLineupChemistry(players, { ...ctx, familiarity: 1, bonds: {} }),
  ).toEqual(fresh);
  expect(
    evaluateLineupChemistry(players, { ...ctx, familiarity: 1 }).score,
  ).toBeGreaterThan(evaluateLineupChemistry(players, ctx).score);
});
it("actual package trades carry a pair without giving other arrivals inherited slot familiarity", async () => {
  const { exchangePackage } = await import("./rosterTrades");
  const a = team([1, 2, 3, 4, 5, 6, 7, 8]),
    b = team([9, 10, 11, 12, 13, 14, 15, 16], 1);
  a.chemistryBonds = { "1:2": 1200, "1:3": 500 };
  const result = exchangePackage([a, b], 0, 1, [1, 2], [9, 10]);
  expect(result[1].chemistryBonds!["1:2"]).toBe(1200);
  expect(result[0].chemistryBonds!["3:9"]).toBeUndefined();
  expect(a.roster.PG).toBe(1);
  const reunited = exchangePackage(result, 0, 1, [9], [1]);
  expect(reunited[0].chemistryBonds!["1:3"]).toBe(500);
});
