import { masteryFactor } from "./masteryMath";
import { speciesAbility, type AbilityMechanic } from "./abilities";
import type { PlayerProfile } from "./playerProfile";
import { clamp } from "./ratings";

/** Expected usefulness in the player's actual role, not just an ability-name match. */
export function abilityUsefulness(
  pokemonId: number,
  p: PlayerProfile,
  xp = 0,
): number {
  const a = p.attributes;
  const shooting = (a.threePoint + a.midRange) / 2;
  const creation = (a.passing + a.ballHandling + a.composure) / 3;
  const scoring = (a.finishing + shooting) / 2;
  const defense = (a.perimeterDefense + a.interiorDefense) / 2;
  const quality: Record<AbilityMechanic, number> = {
    surge: scoring,
    aerial: (a.finishing * 2 + a.vertical) / 3,
    intimidate: defense,
    perimeter: (a.perimeterDefense * 2 + p.traits.closeout) / 3,
    armor: (a.interiorDefense * 2 + a.block) / 3,
    focus: shooting,
    range: a.threePoint,
    power: a.finishing,
    tempo: (a.speed + a.ballHandling + a.finishing) / 3,
    creator: creation,
    support: creation,
    cleanup: (a.offensiveRebound * 2 + a.finishing) / 3,
    endurance: scoring,
    clutch: (scoring + a.composure) / 2,
    momentum: scoring,
    counter: scoring,
    craft: a.midRange,
    evasion: (defense + a.stamina) / 2,
    rhythm: scoring,
    gamble: (shooting + p.traits.offBall) / 2,
    fresh: (scoring + a.stamina) / 2,
  };
  const mechanic = speciesAbility(pokemonId).mechanic;
  // Infrequent conditions receive less credit; creators and defenders use their
  // own involvement skills rather than a scorer's usage.
  const frequency: Partial<Record<AbilityMechanic, number>> = {
    surge: 0.6,
    endurance: 0.7,
    clutch: 0.35,
    momentum: 0.65,
    counter: 0.65,
    rhythm: 0.5,
    fresh: 0.65,
    cleanup: 0.75,
  };
  const involvement = [
    "creator",
    "support",
    "intimidate",
    "perimeter",
    "armor",
    "evasion",
  ].includes(mechanic)
    ? 1
    : 0.7 + (p.traits.usage / 100) * 0.3;
  return (
    clamp((quality[mechanic] - 30) / 55, 0, 1) *
    involvement *
    (frequency[mechanic] ?? 1) *
    masteryFactor(xp)
  );
}
