import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import {
  snapshotMorale,
  advanceMorale,
  withRosterMorale,
  moraleAssessment,
} from "./playerMorale";
import { snapshotChemistry } from "./teammateChemistry";
import { teamLeadership, playerPersonality } from "./playerPersonality";
import { evaluateLineupChemistry } from "./lineupChemistry";
import { playerProfile } from "./playerProfile";
import { POKEMON_BY_ID } from "../data/pokemon";
const teams = () =>
  createLeague({
    ...createRun("free", true, 772),
    coach: { version: 1, id: "misty" },
    roster: { PG: 65, SG: 135, SF: 68, PF: 95, C: 113, B1: 92, B2: 52, B3: 25 },
  }).slice(0, 2);

it("freezes captains and personality reports for actual games and applies leadership only while a captain is on court", () => {
  const [h, a] = teams();
  const frozen = {
    morale: snapshotMorale(h, a)!,
    chemistry: snapshotChemistry(h, a)!,
  };
  const first = simulateMatch(h, a, 730, frozen),
    compact = simulateMatch(h, a, 730, { ...frozen, collectInsights: false });
  expect(first.moraleReport!.captains!.home).toEqual(teamLeadership(h));
  expect(first.moraleReport!.captains!.away).toEqual(teamLeadership(a));
  expect(
    first.moraleReport!.home.every(
      (p) => p.personality?.pokemonId === p.pokemonId,
    ),
  ).toBe(true);
  expect(compact.moraleReport).toEqual(first.moraleReport);
  expect(compact.homeBox).toEqual(first.homeBox);
  expect(compact.awayBox).toEqual(first.awayBox);
  for (const row of first.insights!.lineups) {
    const captain =
        first.moraleReport!.captains![row.teamId === h.id ? "home" : "away"],
      leadership = row.chemistry!.leadership!;
    expect(leadership.captainId).toBe(captain.captainId);
    expect(leadership.active).toBe(
      row.playerIds.includes(`${row.teamId}:${captain.captainId}`),
    );
    expect(Math.abs(leadership.cohesionDelta)).toBeLessThanOrEqual(2);
    if (!leadership.active) expect(leadership.cohesionDelta).toBe(0);
  }
  for (const p of Object.values(h.morale!)) {
    p.score = 20;
    p.games = 164;
  }
  h.chemistryBonds = { "25:65": 2000, "52:65": 2000 };
  expect(simulateMatch(h, a, 730, frozen)).toEqual(first);
  expect(simulateMatch(h, a, 730).moraleReport).not.toEqual(first.moraleReport);
  expect(() =>
    simulateMatch(h, { ...a, personalityVersion: undefined }, 730),
  ).toThrow(/personality/);
  expect(() =>
    simulateMatch({ ...h, moraleVersion: undefined }, a, 730),
  ).toThrow(/morale/);
});

it("does not grant bench leadership to teammates or invent familiarity, and affects real coordination when the captain plays", () => {
  const [t] = teams(),
    leadership = teamLeadership(t)!;
  const others = (Object.values(t.roster) as number[]).filter(
    (id) => id !== leadership.captainId,
  );
  const actors = (ids: number[]) =>
    ids.map((pokemonId) => ({
      pokemonId,
      profile: playerProfile(POKEMON_BY_ID.get(pokemonId)!),
    }));
  const context = {
    tactic: t.tactic,
    defense: t.defense,
    abilities: true,
    bonds: {},
  };
  const bench = evaluateLineupChemistry(actors(others.slice(0, 5)), {
    ...context,
    leadership,
  });
  const plainBench = evaluateLineupChemistry(
    actors(others.slice(0, 5)),
    context,
  );
  expect(bench.score).toBe(plainBench.score);
  expect(bench.effects).toEqual(plainBench.effects);
  const unit = actors([leadership.captainId, ...others.slice(0, 4)]);
  const plain = evaluateLineupChemistry(unit, context),
    active = evaluateLineupChemistry(unit, { ...context, leadership });
  expect(active.score).toBeGreaterThan(plain.score);
  expect(active.effects[leadership.captainId].passing).toBeGreaterThan(
    plain.effects[leadership.captainId].passing,
  );
  expect(active.continuity).toEqual(plain.continuity);
});

it("varies role expectations and trade adjustment by species, and a confident captain supports teammate morale without self-boosting", () => {
  const [t, donor] = teams(),
    captain = teamLeadership(t)!;
  const ids = Object.values(t.roster) as number[],
    boxes = ids.map((pokemonId) => ({ pokemonId, minutes: 30 }));
  const high = structuredClone(t),
    low = structuredClone(t);
  high.morale![captain.captainId].score = 85;
  low.morale![captain.captainId].score = 20;
  expect(teamLeadership(high)!.captainId).toBe(teamLeadership(low)!.captainId);
  const upbeat = advanceMorale(high, boxes, true),
    downcast = advanceMorale(low, boxes, true);
  expect(
    ids
      .filter((id) => id !== captain.captainId)
      .some((id) => upbeat[id].score > downcast[id].score),
  ).toBe(true);
  expect(moraleAssessment(high, captain.captainId).captainSupport).toBe(0);
  expect(
    ids.some(
      (id) =>
        moraleAssessment(t, id).expectedMinutes !==
        moraleAssessment({ ...t, personalityVersion: undefined }, id)
          .expectedMinutes,
    ),
  ).toBe(true);
  const transferred = ids.slice(0, 2),
    roster = { ...donor.roster, PG: transferred[0], SG: transferred[1] };
  const next = withRosterMorale(
    { ...donor, roster },
    donor,
    [t, donor],
    "trade",
  );
  expect(
    new Set(transferred.map((id) => next.morale![id].disruption)).size,
  ).toBe(2);
  for (const id of transferred) {
    expect(next.morale![id].score).toBeLessThan(t.morale![id].score);
    expect(playerPersonality(id)).toBe(moraleAssessment(next, id).personality);
    expect(next.morale![id].games).toBe(t.morale![id].games);
  }
});
