import {
  abilitiesEnabled,
  speciesAbility,
  type AbilityMechanic,
} from "./abilities";
import { clamp } from "./ratings";

export interface PhysicalAbilityEffects {
  movement: number;
  screen: number;
  navigation: number;
  rebound: number;
  drain: number;
  recovery: number;
}
export const NEUTRAL_PHYSICAL_ABILITY: Readonly<PhysicalAbilityEffects> =
  Object.freeze({
    movement: 1,
    screen: 1,
    navigation: 1,
    rebound: 1,
    drain: 1,
    recovery: 1,
  });
export function physicalAbilitiesEnabled(team: {
  physicalAbilityVersion?: 1;
  abilityVersion?: 1;
  engineRules?: { abilities: boolean };
}): boolean {
  return team.physicalAbilityVersion === 1 && abilitiesEnabled(team);
}
const profiles: Partial<
  Record<AbilityMechanic, Partial<PhysicalAbilityEffects>>
> = {
  aerial: { movement: 1.04, navigation: 1.06, rebound: 1.08 },
  intimidate: { screen: 1.08 },
  perimeter: { screen: 1.06 },
  armor: { screen: 1.12, rebound: 1.04 },
  focus: { navigation: 1.08 },
  power: { screen: 1.12, rebound: 1.06 },
  tempo: { movement: 1.08 },
  creator: { navigation: 1.04 },
  support: { recovery: 1.06 },
  cleanup: { rebound: 1.12 },
  endurance: { drain: 0.82, recovery: 1.18 },
  evasion: { movement: 1.04, navigation: 1.08 },
  fresh: { recovery: 1.15 },
};
const table = new Map<AbilityMechanic, Readonly<PhysicalAbilityEffects>>();
for (const [mechanic, effect] of Object.entries(profiles))
  table.set(
    mechanic as AbilityMechanic,
    Object.freeze({ ...NEUTRAL_PHYSICAL_ABILITY, ...effect }),
  );
const surge = Object.freeze({ ...NEUTRAL_PHYSICAL_ABILITY, movement: 1.05 });
const fresh = Object.freeze({ ...table.get("fresh")!, movement: 1.03 });
/** Basketball adaptations. Multipliers are applied once at action resolution, never to stored ratings. */
export function physicalAbilityEffects(
  pokemonId: number,
  energy = 100,
): Readonly<PhysicalAbilityEffects> {
  const mechanic = speciesAbility(pokemonId).mechanic;
  if (mechanic === "surge" && energy <= 55) return surge;
  if (mechanic === "fresh" && energy > 75) return fresh;
  return table.get(mechanic) ?? NEUTRAL_PHYSICAL_ABILITY;
}
export function physicalPlayerEffects(player: {
  physicalAbilities?: true;
  box: { pokemonId: number };
  energy: number;
}) {
  return player.physicalAbilities
    ? physicalAbilityEffects(player.box.pokemonId, player.energy)
    : NEUTRAL_PHYSICAL_ABILITY;
}
/** Account for the energy floor/cap before reporting an actual benefit. */
export function abilityEnergyChange(
  pokemonId: number,
  energy: number,
  delta: number,
  enabled: boolean,
  floor = 0,
) {
  const e = enabled
    ? physicalAbilityEffects(pokemonId, energy)
    : NEUTRAL_PHYSICAL_ABILITY;
  const baseline = clamp(energy + delta, floor, 100);
  const adjusted = clamp(
    energy + delta * (delta < 0 ? e.drain : e.recovery),
    floor,
    100,
  );
  return { energy: adjusted, saved: Math.max(0, adjusted - baseline) };
}
export function physicalAbilityDescription(pokemonId: number): string {
  const mechanic = speciesAbility(pokemonId).mechanic;
  const e = physicalAbilityEffects(pokemonId, mechanic === "surge" ? 40 : 100);
  const parts: string[] = [];
  const pct = (v: number) => Math.round((v - 1) * 100);
  if (e.movement !== 1)
    parts.push(
      `${pct(e.movement)}% faster movement${mechanic === "surge" ? " at 55 energy or less" : mechanic === "fresh" ? " above 75 energy" : ""}`,
    );
  if (e.screen !== 1) parts.push(`${pct(e.screen)}% stronger screens`);
  if (e.navigation !== 1)
    parts.push(`${pct(e.navigation)}% better screen navigation`);
  if (e.rebound !== 1)
    parts.push(`${pct(e.rebound)}% stronger rebound pursuit`);
  if (e.drain !== 1)
    parts.push(`${Math.round((1 - e.drain) * 100)}% less energy drain`);
  if (e.recovery !== 1)
    parts.push(`${pct(e.recovery)}% faster energy recovery`);
  return parts.length
    ? `${parts.join("; ")}.`
    : "No additional physical effect; this ability specializes in shot outcomes.";
}
