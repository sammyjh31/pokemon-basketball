import { expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { playerProfile } from "./playerProfile";
import {
  moveToward,
  createCourt,
  applyScreenCoverage,
} from "./courtPossession";
import { NEUTRAL_CHEMISTRY_EFFECTS } from "./lineupChemistry";
import { getMatchChemistry, refreshLineupChemistry } from "./matchChemistry";
import { insightBox, insightTeams } from "./insightAnalysis.testUtils";
import type { Player, Team } from "./matchLineups";
const actor = (pokemonId: number): Player => ({
  profile: structuredClone(playerProfile(POKEMON_BY_ID.get(pokemonId)!)),
  energy: 80,
  types: [],
  typeEdges: new Map(),
  target: 30,
  consecutive: 0,
  box: insightBox({ pokemonId }),
});
it("changes actual movement and contact without inventing individual ability activations", () => {
  const offense = [65, 135, 68, 113, 95].map(actor),
    defense = [1, 2, 3, 4, 5].map(actor);
  const player = offense[0],
    from = { x: 0, y: 0 },
    to = { x: 20, y: 0 };
  const plain = moveToward(from, to, player, 0.4);
  player.chemistry = { ...NEUTRAL_CHEMISTRY_EFFECTS, movement: 1.04 };
  expect(moveToward(from, to, player, 0.4).x).toBeGreaterThan(plain.x);
  expect(player.box.abilityActivations?.physical).toBeUndefined();
  const c = {
    offense,
    defense,
    guards: new Map(offense.map((p, i) => [p, defense[i]])),
    handler: player,
    screener: offense[4],
    play: "pickRoll" as const,
    tactic: "balanced" as const,
    scheme: "man" as const,
    shotClock: 24,
    periodRemaining: 720,
  };
  for (const coverage of ["drop", "hedge", "trap"] as const) {
    const gap = () => {
      const court = createCourt(c);
      applyScreenCoverage(court, c, coverage);
      return Math.abs(court.get(player)!.y - court.get(defense[0])!.y);
    };
    delete c.screener.chemistry;
    delete defense[0].chemistry;
    const baseline = gap();
    c.screener.chemistry = { ...NEUTRAL_CHEMISTRY_EFFECTS, screen: 1.04 };
    const screen = gap();
    expect(screen).toBeGreaterThan(baseline);
    defense[0].chemistry = { ...NEUTRAL_CHEMISTRY_EFFECTS, navigation: 1.03 };
    expect(gap()).toBeLessThan(screen);
    expect(c.screener.box.abilityActivations?.physical).toBeUndefined();
  }
});
it("refreshes effects after substitutions, scheme changes, and ability toggles", () => {
  const players = [311, 312, 95, 68, 65, 1, 2, 3].map(actor);
  const team: Team = {
    config: {
      ...insightTeams[0],
      chemistryVersion: 1,
      abilityVersion: 1,
      tactic: "balanced",
      defense: "man",
    },
    players,
    floor: players.slice(0, 5),
    side: "home",
    fouls: 0,
    transition: 0,
  };
  refreshLineupChemistry(team);
  const original = getMatchChemistry(team)!;
  expect(original.links.some((l) => l.label === "Plus / Minus")).toBe(true);
  expect(getMatchChemistry(team)).toBe(original);
  team.floor[1] = players[5];
  refreshLineupChemistry(team);
  expect(players[1].chemistry).toBeUndefined();
  expect(
    getMatchChemistry(team)!.links.some((l) => l.label === "Plus / Minus"),
  ).toBe(false);
  team.config.tactic = "pace";
  expect(getMatchChemistry(team)).not.toBe(original);
  team.config.engineRules = {
    version: 1,
    abilities: false,
    adaptiveCoaching: false,
    familiarity: 0,
  };
  refreshLineupChemistry(team);
  expect(getMatchChemistry(team)!.links).toHaveLength(0);
  expect(team.floor.every((p) => p.chemistry)).toBe(true);
  delete team.config.chemistryVersion;
  refreshLineupChemistry(team);
  expect(players.every((p) => p.chemistry === undefined)).toBe(true);
});

it("keeps active groups distinct across role order and roster order without stale shared history", () => {
  const players = [311, 312, 95, 68, 65, 1, 2, 3].map(actor);
  const team: Team = {
    config: {
      ...insightTeams[0],
      chemistryVersion: 1,
      chemistryGrowthVersion: 1,
      chemistryBonds: {},
      abilityVersion: 1,
      tactic: "balanced",
      defense: "man",
    },
    players: [...players],
    floor: players.slice(0, 5),
    side: "home",
    fouls: 0,
    transition: 0,
  };
  const original = getMatchChemistry(team)!;
  expect(original.links.some((link) => link.label === "Plus / Minus")).toBe(
    true,
  );
  team.floor.reverse();
  team.players.reverse();
  expect(getMatchChemistry(team)).toBe(original);
  const reserveUnit = [players[0], ...players.slice(2, 6)];
  const reserves = getMatchChemistry(team, reserveUnit)!;
  expect(reserves.links.some((link) => link.label === "Plus / Minus")).toBe(
    false,
  );
  expect(
    Object.keys(reserves.effects)
      .map(Number)
      .sort((a, b) => a - b),
  ).toEqual([1, 65, 68, 95, 311]);
  team.config.chemistryBonds = { "311:312": 1000 };
  expect(getMatchChemistry(team)!.continuity!.sharedMinutes).toBe(100);
  expect(getMatchChemistry(team, reserveUnit)!.continuity!.sharedMinutes).toBe(
    0,
  );
  expect(() => getMatchChemistry(team, [players[0], players[0]])).toThrow();
});
