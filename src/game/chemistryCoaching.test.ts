import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  chooseLineup,
  replaceFoulOut,
  type Team,
  type Player,
} from "./matchLineups";
import { insightBox, insightTeams } from "./insightAnalysis.testUtils";
import { POSITIONS, ROSTER_SLOTS } from "./types";

function team(): Team {
  const ids = [311, 1, 2, 3, 4, 312, 5, 6];
  const players = ids.map((pokemonId, i): Player => {
    const profile = structuredClone(playerProfile(POKEMON_BY_ID.get(25)!));
    profile.positions = { PG: 70, SG: 70, SF: 70, PF: 70, C: 70 };
    return {
      profile,
      types: [],
      typeEdges: new Map(),
      target: 30,
      energy: 100,
      consecutive: 0,
      box: insightBox({
        pokemonId,
        slot: ROSTER_SLOTS[i],
        fouls: 0,
        minutes: 0,
      }),
    };
  });
  return {
    config: { ...insightTeams[0], chemistryVersion: 1, abilityVersion: 1 },
    players,
    floor: players.slice(0, 5),
    side: "home",
    fouls: 0,
    transition: 0,
  };
}

describe("chemistry coaching", () => {
  it("brings a complementary partner off the bench when individual role scores are equal", () => {
    const t = team();
    chooseLineup(t, 0, false);
    expect(t.floor.map((p) => p.box.pokemonId)).toContain(311);
    expect(t.floor.map((p) => p.box.pokemonId)).toContain(312);
    expect(t.floor.every((p) => p.chemistry !== undefined)).toBe(true);
    expect(
      t.players
        .filter((p) => !t.floor.includes(p))
        .every((p) => p.chemistry === undefined),
    ).toBe(true);
  });
  it("keeps manual minutes, closers, foul eligibility and fatigue ahead of a combination", () => {
    const t = team();
    t.config.rotationPlan = {
      minutes: { PG: 40, SG: 40, SF: 40, PF: 40, C: 40, B1: 0, B2: 20, B3: 20 },
      closing: [...POSITIONS],
    };
    t.players[5].target = 0;
    chooseLineup(t, 20, false);
    expect(t.floor).not.toContain(t.players[5]);
    chooseLineup(t, 46, true);
    expect(t.floor.map((p) => p.box.slot).sort()).toEqual(
      [...POSITIONS].sort(),
    );
    t.floor[0].box.fouls = 6;
    const removed = t.floor[0];
    replaceFoulOut(t);
    expect(t.floor).not.toContain(removed);
    expect(removed.chemistry).toBeUndefined();
    expect(t.floor.every((p) => p.chemistry !== undefined)).toBe(true);
    const fresh = team();
    fresh.players[5].energy = 0;
    chooseLineup(fresh, 0, false);
    expect(fresh.floor).not.toContain(fresh.players[5]);
  });
});
