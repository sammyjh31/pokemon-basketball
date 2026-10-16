import { describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  chooseLineup,
  replaceFoulOut,
  type Player,
  type Team,
} from "./matchLineups";
import { typeMatchup } from "./typeMatchups";
import {
  POSITIONS,
  ROSTER_SLOTS,
  type LeagueBox,
  type LeagueTeam,
} from "./types";

// Equal basketball skills isolate the coaching decision; these are real rotation inputs.
function team(types: string[], typed = true): Team {
  const profile = structuredClone(playerProfile(POKEMON_BY_ID.get(25)!));
  profile.positions = { PG: 70, SG: 70, SF: 70, PF: 70, C: 70 };
  profile.attributes.composure = 70;
  const players = types.map((type, i): Player => ({
    types: [type],
    typeEdges: new Map(),
    profile: structuredClone(profile),
    target: 30,
    energy: 100,
    consecutive: 0,
    box: {
      pokemonId: i + 1,
      slot: ROSTER_SLOTS[i],
      fouls: 0,
      minutes: 0,
    } as LeagueBox,
  }));
  return {
    config: { ...(typed ? { typeMatchupsVersion: 1 } : {}) } as LeagueTeam,
    players,
    floor: players.slice(0, 5),
    side: "home",
    fouls: 0,
    transition: 0,
  };
}
function scout(a: Team, b: Team) {
  for (const [ours, theirs] of [
    [a, b],
    [b, a],
  ])
    for (const p of ours.players)
      for (const q of theirs.players)
        p.typeEdges.set(q, typeMatchup(p.types, q.types).edge);
}
const roster = [
  "normal",
  "normal",
  "normal",
  "normal",
  "normal",
  "electric",
  "water",
  "grass",
];

describe("type-aware rotation decisions", () => {
  it("does not count a role reshuffle as a direct counter substitution", () => {
    const ours = team([
      "normal",
      "grass",
      "normal",
      "normal",
      "normal",
      "water",
      "normal",
      "normal",
    ]);
    const foes = team(Array(8).fill("ground"));
    scout(ours, foes);
    ours.counterSubstitutions = 0;
    ours.players[0].profile.positions.SG = 90;
    ours.players[1].profile.positions = {
      PG: 10,
      SG: 70,
      SF: 10,
      PF: 10,
      C: 10,
    };
    ours.players[5].profile.positions = {
      PG: 90,
      SG: 10,
      SF: 10,
      PF: 10,
      C: 10,
    };
    chooseLineup(ours, 1, false, foes.floor);
    expect(ours.floor[0].box.slot).toBe("B1");
    expect(ours.floor[1].box.slot).toBe("PG");
    expect(ours.floor.some((p) => p.box.slot === "SG")).toBe(false);
    expect(ours.counterSubstitutions).toBe(0);
  });

  it("brings a bench counter in, then responds to an opposing lineup change", () => {
    const ours = team(roster),
      water = team(Array(8).fill("water")),
      ground = team(Array(8).fill("ground"));
    scout(ours, water);
    chooseLineup(ours, 0, false, water.floor);
    expect(ours.floor).toContain(ours.players[5]); // Electric punishes Water.
    scout(ours, ground);
    chooseLineup(ours, 0, false, ground.floor);
    expect(ours.floor).not.toContain(ours.players[5]); // Ground counters Electric.
    expect(ours.floor).toContain(ours.players[6]);
    expect(new Set(ours.floor).size).toBe(5);
  });

  it("uses defensive resistance and actual court roles, not just offensive coverage", () => {
    const ours = team([
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "ground",
      "normal",
      "normal",
    ]);
    const foes = team([
      "electric",
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
      "normal",
    ]);
    scout(ours, foes);
    chooseLineup(ours, 0, false, foes.floor);
    expect(ours.floor[0].box.slot).toBe("B1");
  });

  it("keeps exhausted or badly out-of-position counters behind healthy suitable players", () => {
    const ours = team(roster),
      foes = team(Array(8).fill("water"));
    scout(ours, foes);
    ours.players[5].energy = 25;
    ours.players[7].profile.positions = {
      PG: 10,
      SG: 10,
      SF: 10,
      PF: 10,
      C: 10,
    };
    chooseLineup(ours, 0, false, foes.floor);
    expect(ours.floor).not.toContain(ours.players[5]);
    expect(ours.floor).not.toContain(ours.players[7]);
  });

  it("respects excluded reserves, closing selections and foul-out eligibility", () => {
    const ours = team(roster),
      foes = team(Array(8).fill("water"));
    scout(ours, foes);
    ours.config.rotationPlan = {
      minutes: { PG: 40, SG: 40, SF: 40, PF: 40, C: 40, B1: 0, B2: 20, B3: 20 },
      closing: [...POSITIONS],
    };
    ours.players[5].target = 0;
    chooseLineup(ours, 20, false, foes.floor);
    expect(ours.floor).not.toContain(ours.players[5]);
    chooseLineup(ours, 46, true, foes.floor);
    expect(ours.floor.map((p) => p.box.slot).sort()).toEqual(
      [...POSITIONS].sort(),
    );
    ours.floor[0].box.fouls = 6;
    replaceFoulOut(ours, foes.floor);
    expect(ours.floor.every((p) => p.box.fouls < 6)).toBe(true);
    expect(ours.floor).toContain(ours.players[7]);
  });

  it("keeps historical untyped rotations independent of opposing types", () => {
    const ours = team(roster, false),
      foes = team(Array(8).fill("water"));
    scout(ours, foes);
    chooseLineup(ours, 0, false, foes.floor);
    expect(ours.floor.map((p) => p.box.slot).sort()).toEqual(
      [...POSITIONS].sort(),
    );
  });
});
