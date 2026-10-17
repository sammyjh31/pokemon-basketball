import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { retainMorale, snapshotMorale } from "./playerMorale";
import { evaluateLineupChemistry } from "./lineupChemistry";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
const teams = () =>
  createLeague({
    ...createRun("free", true, 772),
    coach: { version: 1, id: "misty" },
    roster: { PG: 65, SG: 135, SF: 68, PF: 95, C: 113, B1: 92, B2: 52, B3: 25 },
  })
    .slice(0, 2)
    .map(retainMorale);
it("freezes pregame morale, changes execution and yields the same morale report in compact/full replay", () => {
  const [h, a] = teams();
  for (const p of Object.values(h.morale)) p.score = 80;
  const frozen = snapshotMorale(h, a)!;
  const before = JSON.stringify([h, a]);
  const first = simulateMatch(h, a, 77, { morale: frozen });
  const compact = simulateMatch(h, a, 77, {
    morale: frozen,
    collectInsights: false,
  });
  expect(first.moraleReport?.home).toHaveLength(8);
  expect(compact.moraleReport).toEqual(first.moraleReport);
  expect(compact.homeBox).toEqual(first.homeBox);
  expect(JSON.stringify([h, a])).toBe(before);
  for (const p of Object.values(h.morale)) p.score = 20;
  expect(simulateMatch(h, a, 77, { morale: frozen })).toEqual(first);
  expect(simulateMatch(h, a, 77).homeBox).not.toEqual(first.homeBox);
  expect(() =>
    simulateMatch(h, { ...a, moraleVersion: undefined }, 77),
  ).toThrow(/morale/);
});
it("uses only the active five for bounded morale cohesion and does not invent shared minutes", () => {
  const [t] = teams();
  const players = Object.values(t.roster)
    .slice(0, 5)
    .map((id) => ({
      pokemonId: id!,
      profile: playerProfile(POKEMON_BY_ID.get(id!)!),
    }));
  const context = {
    tactic: t.tactic,
    defense: t.defense,
    abilities: true,
    bonds: { "65:135": 500 },
  };
  const low = evaluateLineupChemistry(players, {
    ...context,
    morale: Object.fromEntries(players.map((p) => [p.pokemonId, 0])),
  });
  const high = evaluateLineupChemistry(players, {
    ...context,
    morale: {
      ...Object.fromEntries(players.map((p) => [p.pokemonId, 100])),
      92: 0,
      52: 0,
      25: 0,
    },
  });
  expect(high.morale?.cohesionDelta).toBe(4);
  expect(low.morale?.cohesionDelta).toBe(-4);
  expect(high.score - low.score).toBeCloseTo(8);
  expect(high.continuity).toEqual(low.continuity);
  expect(high.effects[65].passing).toBeGreaterThan(low.effects[65].passing);
});
