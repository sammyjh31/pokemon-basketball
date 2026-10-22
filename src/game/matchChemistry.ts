import { moraleScores, type MoraleRoster } from "./playerMorale";
import { abilitiesEnabled } from "./abilities";
import {
  chemistryEnabled,
  evaluateLineupChemistry,
  type LineupChemistry,
  type ChemistryContext,
} from "./lineupChemistry";
import type { Player, Team } from "./matchLineups";
import { teamLeadership } from "./playerPersonality";
interface Cache {
  tactic: Team["config"]["tactic"];
  defense: Team["config"]["defense"];
  abilities: boolean;
  familiarity: number;
  personality: number;
  playerBits: Map<Player, number>;
  bonds?: import("./teammateChemistry").PairBonds;
  lineups: Map<number | string, LineupChemistry>;
  morale?: MoraleRoster;
  context: ChemistryContext;
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
  const { tactic, defense } = team.config;
  const personality = team.config.personalityVersion ?? 0;
  let stored = cache.get(team);
  if (
    !stored ||
    stored.tactic !== tactic ||
    stored.defense !== defense ||
    stored.abilities !== abilities ||
    stored.familiarity !== familiarity ||
    stored.personality !== personality ||
    stored.bonds !== bonds ||
    stored.morale !== morale
  ) {
    const leadership = teamLeadership(team.config);
    stored = {
      tactic,
      defense,
      abilities,
      familiarity,
      personality,
      playerBits: new Map(team.players.slice(0, 30).map((p, i) => [p, 1 << i])),
      bonds,
      morale,
      context: {
        tactic,
        defense,
        abilities,
        familiarity,
        ...(leadership ? { leadership } : {}),
        ...(bonds ? { bonds } : {}),
        ...(team.config.moraleVersion === 1
          ? { morale: moraleScores(team.config) }
          : {}),
      },
      lineups: new Map(),
    };
    cache.set(team, stored);
  }
  // Players stay fixed within a match. A bitset identifies an unordered group
  // without allocating and sorting species IDs for every candidate lineup.
  let bits = 0;
  let knownGroup = true;
  for (const player of floor) {
    const bit = stored.playerBits.get(player);
    if (bit === undefined || (bits & bit) !== 0) {
      knownGroup = false;
      break;
    }
    bits |= bit;
  }
  // Preserve duplicate validation and support callers with an external player.
  const key = knownGroup
    ? bits
    : floor
        .map((p) => p.box.pokemonId)
        .sort((a, b) => a - b)
        .join(",");
  let result = stored.lineups.get(key);
  if (!result) {
    result = evaluateLineupChemistry(
      floor.map((p) => ({ pokemonId: p.box.pokemonId, profile: p.profile })),
      stored.context,
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
