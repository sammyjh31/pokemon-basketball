import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import type { Player } from "./matchLineups";
import type { LeagueBox } from "./types";
import { typeMatchup } from "./typeMatchups";
import {
  assignTypeDefenders,
  chooseTypeHelp,
  shouldSwitchScreen,
  scoutedThreat,
  scoutedCoverage,
  screenCoverage,
} from "./typeTactics";
import type { OpponentScouting } from "./typeTacticsTypes";

function player(id: number, type: string): Player {
  const profile = structuredClone(playerProfile(POKEMON_BY_ID.get(25)!));
  for (const key of Object.keys(
    profile.attributes,
  ) as (keyof typeof profile.attributes)[])
    profile.attributes[key] = 70;
  profile.positions = { PG: 70, SG: 70, SF: 70, PF: 70, C: 70 };
  return {
    types: [type],
    typeEdges: new Map(),
    profile,
    target: 30,
    energy: 100,
    consecutive: 0,
    box: { pokemonId: id, playerId: String(id), fouls: 0 } as LeagueBox,
  };
}
function connect(a: Player[], b: Player[]) {
  for (const [ours, theirs] of [
    [a, b],
    [b, a],
  ])
    for (const p of ours)
      for (const q of theirs)
        p.typeEdges.set(q, typeMatchup(p.types, q.types).edge);
}
const empty = (): OpponentScouting => ({
  games: 0,
  possessions: 0,
  pickRolls: 0,
  switches: 0,
  helpRotations: 0,
  players: {},
});

it("cross-matches resistant defenders while assigning exactly one to every attacker", () => {
  const attack = [
    player(1, "electric"),
    player(2, "fire"),
    player(3, "water"),
    player(4, "normal"),
    player(5, "normal"),
  ];
  const defense = [
    player(11, "water"),
    player(12, "grass"),
    player(13, "ground"),
    player(14, "normal"),
    player(15, "normal"),
  ];
  connect(attack, defense);
  const map = assignTypeDefenders(attack, defense, empty());
  expect(map.get(attack[0])!.box.pokemonId).toBe(13);
  expect(map.get(attack[1])!.box.pokemonId).toBe(11);
  expect(map.get(attack[2])!.box.pokemonId).toBe(12);
  expect(new Set(map.values()).size).toBe(5);
});

it("switches screens only when the resulting pair of matchups is defensible", () => {
  const handler = player(1, "electric"),
    roller = player(2, "water"),
    ground = player(11, "ground"),
    water = player(12, "water");
  connect([handler, roller], [ground, water]);
  expect(
    shouldSwitchScreen(handler, roller, water, ground, "man", empty()),
  ).toBe(true);
  expect(
    shouldSwitchScreen(handler, roller, ground, water, "switch", empty()),
  ).toBe(false);
});

it("uses resistant help without abandoning the most dangerous available shooter", () => {
  const attack = [
    player(1, "fire"),
    player(2, "normal"),
    player(3, "normal"),
    player(4, "normal"),
    player(5, "normal"),
  ];
  const defense = [
    player(11, "grass"),
    player(12, "water"),
    player(13, "water"),
    player(14, "grass"),
    player(15, "grass"),
  ];
  attack[1].profile.attributes.threePoint = 100;
  attack[2].profile.attributes.threePoint = 25;
  connect(attack, defense);
  const guards = new Map(attack.map((p, i) => [p, defense[i]]));
  const help = chooseTypeHelp(
    attack[0],
    defense[0],
    attack,
    defense,
    guards,
    empty(),
  );
  expect(help?.helper.box.pokemonId).toBe(13);
  expect(help?.abandoned.box.pokemonId).toBe(3);
  defense[2].energy = 10;
  expect(
    chooseTypeHelp(attack[0], defense[0], attack, defense, guards, empty())
      ?.helper.box.pokemonId,
  ).not.toBe(13);
});

it("does not send help into a neutral matchup that exposes strong shooters", () => {
  const attack = Array.from({ length: 5 }, (_, i) => player(i + 1, "normal"));
  const defense = Array.from({ length: 5 }, (_, i) => player(i + 11, "normal"));
  connect(attack, defense);
  const guards = new Map(attack.map((p, i) => [p, defense[i]]));
  expect(
    chooseTypeHelp(attack[0], defense[0], attack, defense, guards, empty()),
  ).toBeUndefined();
});

it("learns a productive scoring threat only from recorded attempts with bounded confidence", () => {
  const p = player(1, "normal"),
    history = empty();
  const baseline = scoutedThreat(p, history);
  history.games = 2;
  history.players[1] = {
    attempts: 25,
    points: 40,
    rimAttempts: 20,
    threeAttempts: 5,
  };
  expect(scoutedThreat(p, history)).toBeGreaterThan(baseline);
  expect(scoutedThreat(p, history)).toBeLessThanOrEqual(2);
  expect(scoutedThreat(player(2, "normal"), history)).toBe(baseline);
});

it("learns whether a scoring threat attacks the rim or the perimeter", () => {
  const attack = [player(1, "normal"), player(2, "normal")];
  const defense = [player(11, "normal"), player(12, "normal")];
  defense[0].profile.attributes.perimeterDefense = 100;
  defense[0].profile.attributes.interiorDefense = 35;
  defense[1].profile.attributes.perimeterDefense = 35;
  defense[1].profile.attributes.interiorDefense = 100;
  connect(attack, defense);
  const history = empty();
  history.games = 2;
  history.players = {
    1: { attempts: 20, points: 30, rimAttempts: 20, threeAttempts: 0 },
    2: { attempts: 20, points: 30, rimAttempts: 0, threeAttempts: 20 },
  };
  const guards = assignTypeDefenders(attack, defense, history);
  expect(guards.get(attack[0])).toBe(defense[1]);
  expect(guards.get(attack[1])).toBe(defense[0]);
});

it("interprets observed defensive events per team possession", () => {
  const history = empty();
  history.games = 1;
  history.possessions = 100;
  history.switches = 25;
  history.helpRotations = 10;
  expect(scoutedCoverage(history)).toEqual({ switches: 0.25, help: 0.1 });
});

it("uses the actual screen response for shot coverage in either shot model", () => {
  expect(screenCoverage("man", true)).toBe("switch");
  expect(screenCoverage("switch", false)).toBe("man");
  expect(screenCoverage("zone", false)).toBe("zone");
  expect(screenCoverage("press", true)).toBe("press");
});
