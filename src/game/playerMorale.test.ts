import { expect, it } from "vitest";
import { insightTeams } from "./insightAnalysis.testUtils";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  neutralMorale,
  retainMorale,
  moraleAssessment,
  advanceMorale,
  withRosterMorale,
  snapshotMorale,
  applyMoraleSnapshot,
  validateMoraleRoster,
  moraleProfile,
  initialMoraleBanks,
  recordMoraleGame,
} from "./playerMorale";
const team = (index = 0) =>
  retainMorale({
    ...insightTeams[index],
    chemistryVersion: 1 as const,
    chemistryGrowthVersion: 1 as const,
    coach: { version: 1 as const, id: "misty" },
  });
const ids = (t: ReturnType<typeof team>) => Object.values(t.roster) as number[];
it("reacts to actual minutes and winning, with role expectations independent of assigned minutes", () => {
  let a = team(),
    b = team();
  const id = ids(a)[0];
  const expected = moraleAssessment(a, id).expectedMinutes;
  for (let i = 0; i < 24; i++) {
    a = {
      ...a,
      morale: advanceMorale(
        a,
        ids(a).map((pokemonId) => ({
          pokemonId,
          minutes: pokemonId === id ? 40 : 28,
        })),
        true,
      ),
    };
    b = {
      ...b,
      morale: advanceMorale(
        b,
        ids(b).map((pokemonId) => ({
          pokemonId,
          minutes: pokemonId === id ? 0 : 32,
        })),
        false,
      ),
    };
  }
  expect(a.morale[id].score).toBeGreaterThan(b.morale[id].score + 10);
  const bench = { ...b, rotation: "bench" as const };
  expect(moraleAssessment(bench, id).expectedMinutes).toBe(expected);
  expect(moraleAssessment(b, id).action).toBe("role-support");
  expect(moraleAssessment(b, id).minuteAdjustment).toBeGreaterThan(0);
  expect(b.morale[id].score).toBeGreaterThanOrEqual(20);
  const overtime = advanceMorale(
    team(),
    ids(a).map((pokemonId) => ({ pokemonId, minutes: 53 })),
    true,
    1,
  );
  expect(overtime[id].minutes).toBe(48);
});
it("responds to trainer fit and explains automatic workload and newcomer support", () => {
  const t = team(),
    all = ids(t);
  let differed = false;
  for (const id of all) {
    const a = moraleAssessment(t, id),
      b = moraleAssessment({ ...t, coach: { version: 1, id: "brock" } }, id);
    if (Math.abs(a.fit - b.fit) > 1) differed = true;
  }
  expect(differed).toBe(true);
  const id = all[0];
  t.morale[id] = {
    score: 42,
    minutes: 40,
    success: 40,
    disruption: 0,
    games: 10,
  };
  expect(moraleAssessment(t, id).action).toBe("recovery");
  t.morale[id].disruption = -6;
  t.morale[id].minutes = 30;
  expect(moraleAssessment(t, id).action).toBe("settling-in");
});
it("moves species state in package trades, affects remaining teammates, and never gives rookies slot history", () => {
  const a = team(),
    b = team(1),
    aid = ids(a)[0],
    bid = ids(b)[0];
  a.morale[aid] = {
    score: 80,
    minutes: 31,
    success: 70,
    disruption: 0,
    games: 20,
  };
  const next = withRosterMorale(
    { ...b, roster: { ...b.roster, PG: aid } },
    b,
    [a, b],
    "trade",
  );
  expect(next.morale![aid].score).toBe(76);
  expect(next.morale![aid].games).toBe(20);
  expect(next.morale![bid]).toBeUndefined();
  expect(next.morale![ids(b)[1]].disruption).toBeLessThan(0);
  const rookie = withRosterMorale(
    { ...a, roster: { ...a.roster, PG: 252 } },
    a,
    [a, b],
    "rookie",
  );
  expect(rookie.morale![252].games).toBe(0);
  expect(rookie.morale![252].score).toBe(50);
  expect(rookie.morale![aid]).toBeUndefined();
  expect(a.morale[aid].score).toBe(80);
  const retained = retainMorale(next);
  expect(retained.morale[aid].score).toBe(63);
  expect(retainMorale({ ...a, moraleVersion: undefined }).morale[aid]).toEqual(
    neutralMorale(),
  );
});
it("freezes compact snapshots, strictly validates roster state and isolates accumulator mutation", () => {
  const a = team(),
    b = team(1),
    id = ids(a)[0],
    snapshot = snapshotMorale(a, b)!;
  expect(snapshot.home).toHaveLength(40);
  a.morale[id].score = 80;
  expect(applyMoraleSnapshot(a, snapshot.home).morale![id].score).toBe(50);
  expect(() => applyMoraleSnapshot(a, Array(40).fill(NaN))).toThrow();
  for (const bad of [
    {},
    { ...a.morale, [id]: { ...a.morale[id], score: 101 } },
    { ...a.morale, 1026: neutralMorale() },
    { ...a.morale, [id]: { ...a.morale[id], games: 0.5 } },
  ])
    expect(() => validateMoraleRoster(bad, a)).toThrow();
  const bank = initialMoraleBanks([a, b])!,
    before = JSON.stringify([a, b]);
  recordMoraleGame(bank, a, b, {
    homeScore: 100,
    awayScore: 80,
    overtimePeriods: 0,
    homeBox: ids(a).map((pokemonId) => ({ pokemonId, minutes: 30 })),
    awayBox: ids(b).map((pokemonId) => ({ pokemonId, minutes: 30 })),
  });
  expect(bank[a.id][id].games).toBe(1);
  expect(JSON.stringify([a, b])).toBe(before);
});
it("caps temporary execution, preserves physical attributes/base profile and leaves legacy untouched", () => {
  const t = team(),
    id = ids(t)[0],
    raw = playerProfile(POKEMON_BY_ID.get(id)!);
  t.morale[id].score = 100;
  const happy = moraleProfile(raw, t, id);
  expect(happy.attributes.passing - raw.attributes.passing).toBeCloseTo(
    Math.min(3, 100 - raw.attributes.passing),
  );
  expect(happy.attributes.speed).toBe(raw.attributes.speed);
  expect(happy.attributes.strength).toBe(raw.attributes.strength);
  expect(happy.positions).toEqual(raw.positions);
  expect(moraleProfile(raw, { ...t, moraleVersion: undefined }, id)).toBe(raw);
  expect(raw.attributes).not.toBe(happy.attributes);
});
