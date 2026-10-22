import { expect, it, vi } from "vitest";
import * as morale from "./playerMorale";
import { getMatchChemistry } from "./matchChemistry";
import { evaluateLineupChemistry } from "./lineupChemistry";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import { insightBox, insightTeams } from "./insightAnalysis.testUtils";
import { ROSTER_SLOTS } from "./types";
import type { Team, Player } from "./matchLineups";
function team(): Team {
  const ids = [65, 68, 135, 95, 113, 311, 312, 143];
  const players = ids.map((pokemonId, i): Player => ({
    profile: playerProfile(POKEMON_BY_ID.get(pokemonId)!),
    types: [],
    typeEdges: new Map(),
    target: 30,
    energy: 100,
    consecutive: 0,
    box: insightBox({ pokemonId, slot: ROSTER_SLOTS[i] }),
  }));
  return {
    config: {
      ...insightTeams[0],
      roster: Object.fromEntries(
        ROSTER_SLOTS.map((slot, i) => [slot, ids[i]]),
      ) as Team["config"]["roster"],
      abilityVersion: 1,
      chemistryVersion: 1,
      chemistryGrowthVersion: 1,
      moraleVersion: 1,
    },
    players,
    floor: players.slice(0, 5),
    side: "home",
    fouls: 0,
    transition: 0,
  };
}
it("prepares morale only once while considering multiple units under the same match plan", () => {
  const t = team(),
    snapshots = vi.spyOn(morale, "moraleScores");
  try {
    getMatchChemistry(t, t.players.slice(0, 5));
    getMatchChemistry(t, t.players.slice(2, 7));
    expect(snapshots).toHaveBeenCalledTimes(1);
  } finally {
    snapshots.mockRestore();
  }
});
it("invalidates the prepared snapshot when a plan, bonds, morale, or ability rule changes", () => {
  const t = team();
  const verify = () => {
    const expected = evaluateLineupChemistry(
      t.floor.map((p) => ({ pokemonId: p.box.pokemonId, profile: p.profile })),
      {
        tactic: t.config.tactic,
        defense: t.config.defense,
        abilities: t.config.engineRules?.abilities !== false,
        familiarity: t.config.engineRules?.familiarity ?? 0,
        bonds: t.config.chemistryBonds ?? {},
        morale: morale.moraleScores(t.config),
      },
    );
    expect(getMatchChemistry(t)).toEqual(expected);
  };
  verify();
  t.config.tactic = "pace";
  verify();
  t.config.defense = "press";
  verify();
  t.config.morale = {
    65: { score: 90, minutes: 30, success: 50, disruption: 0, games: 4 },
  };
  verify();
  t.config.chemistryBonds = { "65:68": 600 };
  verify();
  t.config.engineRules = {
    version: 1,
    adaptiveCoaching: true,
    abilities: false,
    familiarity: 0.8,
  };
  verify();
  // Foul replacements mutate the active-floor array in place.
  t.floor[0] = t.players[6];
  verify();
  expect(() =>
    getMatchChemistry(t, [t.floor[0], t.floor[0], ...t.floor.slice(2)]),
  ).toThrow(/distinct/);
});
