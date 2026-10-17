import { physicalAbilityEffects } from "./physicalAbilities";
import type { PlayerProfile } from "./playerProfile";
import { clamp } from "./ratings";
import type { DefenseScheme, Position, Tactic } from "./types";

type PhysicalNeeds = Partial<
  Record<
    "defensiveRebound" | "perimeterDefense" | "stamina",
    { weight: number }
  >
>;

/** Expected physical opportunity, in team-value points; never changes base ratings.
 * Half fresh / half tired estimates conditional abilities without favoring only
 * their best energy state. Skill, role and scheme determine usable opportunity.
 */
export function physicalAbilityValue(
  pokemonId: number,
  p: PlayerProfile,
  tactic: Tactic,
  defense: DefenseScheme,
  role: Position = p.bestPosition,
  needs: PhysicalNeeds = {},
  xp = 0,
): number {
  const fresh = physicalAbilityEffects(pokemonId, 90, xp);
  const tired = physicalAbilityEffects(pokemonId, 50, xp);
  const effect = (key: keyof typeof fresh) => (fresh[key] + tired[key]) / 2;
  const a = p.attributes;
  const big = role === "C" || role === "PF";
  const quality = (...skills: number[]) =>
    skills.reduce((n, x) => n + x, 0) / skills.length / 100;
  const need = (key: keyof PhysicalNeeds) =>
    1 + (needs[key]?.weight ?? 0) * 0.2;
  const movement =
    (effect("movement") - 1) *
    15 *
    quality(a.speed, p.traits.offBall, a.ballHandling) *
    (big ? 0.75 : 1) *
    (tactic === "pace" ? 1.25 : tactic === "perimeter" ? 1 : 0.85) *
    (defense === "press" ? 1.1 : 1);
  const screen =
    (effect("screen") - 1) *
    10 *
    quality(p.traits.screening, a.strength) *
    (big ? 1 : 0.55) *
    (tactic === "interior" ? 1.2 : tactic === "balanced" ? 1.05 : 0.75);
  const navigation =
    (effect("navigation") - 1) *
    10 *
    quality(a.speed, a.perimeterDefense, p.traits.discipline) *
    (big ? 0.75 : 1) *
    (defense === "press" || defense === "switch"
      ? 1.2
      : defense === "zone"
        ? 0.75
        : 1) *
    need("perimeterDefense");
  const rebound =
    (effect("rebound") - 1) *
    12 *
    quality(a.offensiveRebound, a.defensiveRebound, a.vertical) *
    (big ? 1 : 0.6) *
    (tactic === "interior" || tactic === "defense" ? 1.15 : 0.85) *
    (defense === "zone" ? 1.1 : 1) *
    need("defensiveRebound");
  const endurance =
    (1 - effect("drain") + (effect("recovery") - 1) * 0.5) *
    8 *
    quality(a.stamina, a.speed) *
    (tactic === "pace" || defense === "press" ? 1.2 : 1) *
    need("stamina");
  return clamp(movement + screen + navigation + rebound + endurance, 0, 4);
}
