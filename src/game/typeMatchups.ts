import { TYPE_CHART } from "../data/typeChart";
import type { ShotZone } from "./shotModel";

export interface TypeMatchup {
  attackType: string | null;
  effectiveness: number;
  /** Basketball edge: immunities are capped resistance, never automatic stops. */
  edge: number;
}
export interface TypeMatchupSummary {
  /** Direct bench replacements improving type coverage in the same court role. */
  counterSubstitutions?: number;
  advantaged: number;
  resisted: number;
  neutral: number;
  shotAttempts: number;
  shotChanceDelta: number;
}
const cache = new Map<string, TypeMatchup>();
const validTypes = (types: readonly string[]) =>
  [...new Set(types.map((type) => type.toLowerCase()))].filter((type) =>
    Object.hasOwn(TYPE_CHART, type),
  );

/** Use the stronger of a player's own types against both of the defender's types.
 * This models choosing an attacking style, not multiplying two simultaneous moves. */
export function typeMatchup(
  attack: readonly string[],
  defense: readonly string[],
): TypeMatchup {
  const key = `${attack.join("/")}:${defense.join("/")}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const attacking = validTypes(attack),
    defending = validTypes(defense);
  let attackType: string | null = null,
    effectiveness = 1;
  if (attacking.length && defending.length) {
    effectiveness = -1;
    for (const type of attacking) {
      const factor = defending.reduce(
        (n, target) => n * (TYPE_CHART[type][target] ?? 1),
        1,
      );
      if (factor > effectiveness) {
        effectiveness = factor;
        attackType = type;
      }
    }
  }
  const result = {
    attackType,
    effectiveness,
    edge: Math.max(-2, Math.min(2, Math.log2(Math.max(0.25, effectiveness)))),
  };
  if (cache.size > 4096) cache.clear();
  cache.set(key, result);
  return result;
}

export function typeShotEffect(
  attack: readonly string[],
  defense: readonly string[],
  zone: ShotZone,
  helpTypes: readonly (readonly string[])[] = [],
) {
  const matchup = typeMatchup(attack, defense);
  const help =
    zone === "rim" && helpTypes.length
      ? helpTypes.reduce(
          (sum, types) => sum + typeMatchup(attack, types).edge,
          0,
        ) / helpTypes.length
      : matchup.edge;
  return { ...matchup, logOdds: typeShotLogOdds(matchup.edge, zone, help) };
}

/** Shared numeric form for the simulator's precomputed player matchups. */
export function typeShotLogOdds(
  edge: number,
  zone: ShotZone,
  helpEdge = edge,
): number {
  // At most 0.28 log odds: about seven percentage points even on a 4x weakness.
  const effectiveEdge = zone === "rim" ? edge * 0.8 + helpEdge * 0.2 : edge;
  return effectiveEdge * (zone === "rim" ? 0.14 : zone === "mid" ? 0.11 : 0.09);
}

export function applyTypeShotEffect(
  probability: number,
  logOdds: number,
): number {
  if (logOdds === 0) return probability;
  const p = Math.max(0.001, Math.min(0.999, probability));
  return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + logOdds)));
}

export function typeMatchupLabel(matchup: TypeMatchup): string {
  return matchup.effectiveness > 1
    ? "Type advantage"
    : matchup.effectiveness === 0
      ? "Strong type resistance"
      : matchup.effectiveness < 1
        ? "Type resistance"
        : "Neutral matchup";
}
