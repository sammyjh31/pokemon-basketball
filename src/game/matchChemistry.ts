import { moraleScores, type MoraleRoster } from "./playerMorale";
import { abilitiesEnabled } from "./abilities";
import {
  chemistryEnabled,
  evaluateLineupChemistry,
  type LineupChemistry,
} from "./lineupChemistry";
import type { Player, Team } from "./matchLineups";
interface Cache {
  context: string;
  bonds?: import("./teammateChemistry").PairBonds;
  lineups: Map<string, LineupChemistry>;
  morale?: MoraleRoster;
}
// Profiles are immutable for a match. Coaching can change the scheme, so that
// context is invalidated independently of the active-five cache.
const EMPTY_BONDS = Object.freeze({});
const cache = new WeakMap<Team, Cache>();
export function getMatchChemistry(
  team: Team,
  floor: readonly Player[] = team.floor,
): LineupChemistry | undefined {
  if (!chemistryEnabled(team.config)) return undefined;
  const abilities = abilitiesEnabled(team.config),
    familiarity = team.config.engineRules?.familiarity ?? 0;
  const bonds =
    team.config.chemistryGrowthVersion === 1
      ? (team.config.chemistryBonds ?? EMPTY_BONDS)
      : undefined;
  const morale =
    team.config.moraleVersion === 1
      ? (team.config.morale ?? EMPTY_BONDS)
      : undefined;
  const context = `${team.config.tactic}:${team.config.defense}:${abilities}:${familiarity}`;
  let stored = cache.get(team);
  if (
    !stored ||
    stored.context !== context ||
    stored.bonds !== bonds ||
    stored.morale !== morale
  ) {
    stored = { context, bonds, morale, lineups: new Map() };
    cache.set(team, stored);
  }
  const key = floor
    .map((p) => p.box.pokemonId)
    .sort((a, b) => a - b)
    .join(",");
  let result = stored.lineups.get(key);
  if (!result) {
    result = evaluateLineupChemistry(
      floor.map((p) => ({ pokemonId: p.box.pokemonId, profile: p.profile })),
      {
        tactic: team.config.tactic,
        defense: team.config.defense,
        abilities,
        familiarity,
        ...(bonds ? { bonds } : {}),
        ...(team.config.moraleVersion === 1
          ? { morale: moraleScores(team.config) }
          : {}),
      },
    );
    stored.lineups.set(key, result);
  }
  return result;
}
export function refreshLineupChemistry(team: Team): void {
  const result = getMatchChemistry(team);
  for (const p of team.players) {
    if (result && team.floor.includes(p))
      p.chemistry = result.effects[p.box.pokemonId];
    else delete p.chemistry;
  }
}
