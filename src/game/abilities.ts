import { masteryFactor } from "./masteryMath";
import catalog from "../data/species-abilities.json";
import type { PlayType, Tactic } from "./types";
import type { PlayerTrainingPlan } from "./franchiseFeatures";

export type AbilityRole = "shooter" | "passer" | "defender";
export interface AbilityActivations {
  offense: number;
  support: number;
  defense: number;
  physical?: PhysicalAbilityStats;
}
export interface PhysicalAbilityStats {
  /** Extra distance actually travelled, in feet, after court bounds. */
  movement: number;
  screens: number;
  rebounds: number;
  /** Conserved/restored energy after the floor and cap. */
  energySaved: number;
}
export function recordPhysicalAbility(
  box: AbilityBox,
  key: keyof PhysicalAbilityStats,
  amount = 1,
) {
  if (!(amount > 0) || !Number.isFinite(amount)) return;
  const stats = (box.abilityActivations ??= emptyAbilityActivations());
  const physical = (stats.physical ??= {
    movement: 0,
    screens: 0,
    rebounds: 0,
    energySaved: 0,
  });
  physical[key] = Math.round((physical[key] + amount) * 1e6) / 1e6;
}
export interface AbilityBox {
  abilityActivations?: AbilityActivations;
}
export interface AbilityContext {
  zone: "rim" | "mid" | "three";
  play: PlayType;
  contested: boolean;
  energy: number;
  clutch: boolean;
  secondChance: boolean;
  period: number;
  /** Score margin from the ability owner's perspective. */
  margin: number;
}
interface Mechanic {
  description: string;
  tactics: Tactic[];
  training: PlayerTrainingPlan["focus"];
  role: AbilityRole;
  effect: (c: AbilityContext) => number;
  names: string;
}
// These are basketball adaptations, not recreations of Pokémon battle rules.
// Explicit groups keep every canonical name auditable; unknown data fails closed.
const mechanics = {
  surge: {
    description:
      "At 55 energy or less, shot probability rises 2.5 percentage points.",
    tactics: ["interior", "pace"],
    training: "conditioning",
    role: "shooter",
    effect: (c) => (c.energy <= 55 ? 0.025 : 0),
    names:
      "overgrow blaze torrent swarm berserk anger-shell electromorphosis thermal-exchange defiant justified rattled",
  },
  aerial: {
    description:
      "Contested rim finishes gain 2 percentage points of shot probability.",
    tactics: ["interior", "pace"],
    training: "position",
    role: "shooter",
    effect: (c) => (c.zone === "rim" && c.contested ? 0.02 : 0),
    names: "levitate light-metal limber wind-rider",
  },
  intimidate: {
    description:
      "Contested opposing shots lose 2 percentage points of shot probability.",
    tactics: ["defense"],
    training: "defense",
    role: "defender",
    effect: (c) => (c.contested ? -0.02 : 0),
    names:
      "intimidate pressure unnerve stench dark-aura aura-break beads-of-ruin tablets-of-ruin vessel-of-ruin",
  },
  perimeter: {
    description:
      "Contested jump shots lose 2.5 percentage points against this defender.",
    tactics: ["defense", "pace"],
    training: "defense",
    role: "defender",
    effect: (c) => (c.contested && c.zone !== "rim" ? -0.025 : 0),
    names:
      "static poison-point effect-spore flame-body cursed-body cute-charm gooey cotton-down lingering-aroma poison-puppeteer toxic-chain toxic-debris mummy wandering-spirit bad-dreams shadow-tag magnet-pull",
  },
  armor: {
    description:
      "Contested rim attempts lose 2.5 percentage points against this defender.",
    tactics: ["defense", "interior"],
    training: "defense",
    role: "defender",
    effect: (c) => (c.contested && c.zone === "rim" ? -0.025 : 0),
    names:
      "sturdy battle-armor shell-armor thick-fat solid-rock prism-armor bulletproof fur-coat fluffy dauntless-shield big-pecks water-compaction rough-skin iron-barbs innards-out aftermath liquid-ooze wonder-guard shadow-shield disguise ice-face shield-dust overcoat soundproof",
  },
  focus: {
    description:
      "Contested jump shots gain 2 percentage points of shot probability.",
    tactics: ["perimeter", "balanced"],
    training: "shooting",
    role: "shooter",
    effect: (c) => (c.contested && c.zone !== "rim" ? 0.02 : 0),
    names:
      "inner-focus own-tempo oblivious clear-body full-metal-body white-smoke hyper-cutter steadfast vital-spirit insomnia immunity leaf-guard flower-veil sweet-veil aroma-veil water-veil good-as-gold purifying-salt wonder-skin",
  },
  range: {
    description:
      "Three-point attempts gain 2 percentage points of shot probability.",
    tactics: ["perimeter"],
    training: "shooting",
    role: "shooter",
    effect: (c) => (c.zone === "three" ? 0.02 : 0),
    names:
      "compound-eyes keen-eye victory-star mega-launcher refrigerate punk-rock steelworker transistor dragons-maw",
  },
  power: {
    description: "Rim attempts gain 2 percentage points of shot probability.",
    tactics: ["interior"],
    training: "position",
    role: "shooter",
    effect: (c) => (c.zone === "rim" ? 0.02 : 0),
    names:
      "guts pure-power iron-fist tough-claws strong-jaw rock-head reckless sheer-force mold-breaker teravolt turboblaze scrappy unseen-fist intrepid-sword sword-of-ruin merciless corrosion",
  },
  tempo: {
    description:
      "Transition shots gain 2.5 percentage points of shot probability.",
    tactics: ["pace"],
    training: "conditioning",
    role: "shooter",
    effect: (c) => (c.play === "transition" ? 0.025 : 0),
    names:
      "speed-boost swift-swim chlorophyll sand-rush slush-rush motor-drive steam-engine unburden run-away quick-feet weak-armor electric-surge surge-surfer protosynthesis quark-drive orichalcum-pulse hadron-engine wind-power",
  },
  creator: {
    description:
      "A pass into a pick-and-roll or spot-up shot gives the receiver 2 percentage points.",
    tactics: ["balanced", "perimeter"],
    training: "playmaking",
    role: "passer",
    effect: (c) => (c.play === "pickRoll" || c.play === "spotUp" ? 0.02 : 0),
    names:
      "telepathy synchronize trace download anticipation forewarn frisk illusion magician prankster dancer receiver opportunist illuminate analytic",
  },
  support: {
    description:
      "A pass into an uncontested shot gives the receiver 2 percentage points.",
    tactics: ["balanced", "perimeter"],
    training: "playmaking",
    role: "passer",
    effect: (c) => (!c.contested ? 0.02 : 0),
    names:
      "plus minus battery power-spot friend-guard healer hospitality commander schooling fairy-aura flower-gift grassy-surge misty-surge psychic-surge seed-sower supersweet-syrup drizzle drought sand-stream snow-warning",
  },
  cleanup: {
    description:
      "Second-chance shots gain 2.5 percentage points of shot probability.",
    tactics: ["interior"],
    training: "position",
    role: "shooter",
    effect: (c) => (c.secondChance ? 0.025 : 0),
    names:
      "pickup honey-gather ball-fetch suction-cups sticky-hold gluttony cheek-pouch cud-chew ripen gulp-missile",
  },
  endurance: {
    description:
      "At 65 energy or less, shot probability rises 1.5 percentage points.",
    tactics: ["pace", "balanced"],
    training: "conditioning",
    role: "shooter",
    effect: (c) => (c.energy <= 65 ? 0.015 : 0),
    names:
      "stamina natural-cure shed-skin hydration dry-skin ice-body rain-dish water-absorb volt-absorb flash-fire sap-sipper earth-eater well-baked-body water-bubble magma-armor heatproof comatose",
  },
  clutch: {
    description:
      "Late close-game shots gain 2.5 percentage points of shot probability.",
    tactics: ["balanced"],
    training: "shooting",
    role: "shooter",
    effect: (c) => (c.clutch ? 0.025 : 0),
    names: "serene-grace super-luck tera-shift zero-to-hero",
  },
  momentum: {
    description: "While ahead, shot probability rises 1.5 percentage points.",
    tactics: ["pace", "interior"],
    training: "position",
    role: "shooter",
    effect: (c) => (c.margin > 0 ? 0.015 : 0),
    names: "beast-boost chilling-neigh grim-neigh soul-heart moxie",
  },
  counter: {
    description:
      "While tied or trailing, shot probability rises 1.5 percentage points.",
    tactics: ["balanced"],
    training: "playmaking",
    role: "shooter",
    effect: (c) => (c.margin <= 0 ? 0.015 : 0),
    names:
      "adaptability contrary simple color-change multitype rks-system forecast stance-change hunger-switch shields-down emergency-exit wimp-out",
  },
  craft: {
    description:
      "Midrange shots gain 2.5 percentage points of shot probability.",
    tactics: ["balanced", "interior"],
    training: "shooting",
    role: "shooter",
    effect: (c) => (c.zone === "mid" ? 0.025 : 0),
    names: "technician mycelium-might sand-force stakeout rivalry",
  },
  evasion: {
    description:
      "Contested shots lose 1.5 percentage points against a defender above 55 energy.",
    tactics: ["defense"],
    training: "conditioning",
    role: "defender",
    effect: (c) => (c.contested && c.energy > 55 ? -0.015 : 0),
    names:
      "sand-veil snow-cloak tangled-feet marvel-scale sand-spit dazzling damp air-lock cloud-nine unaware lightning-rod",
  },
  rhythm: {
    description:
      "First-half shots lose 1 percentage point; second-half shots gain 2.5 points.",
    tactics: ["balanced"],
    training: "conditioning",
    role: "shooter",
    effect: (c) => (c.period <= 2 ? -0.01 : 0.025),
    names: "slow-start truant defeatist",
  },
  gamble: {
    description:
      "Uncontested shots gain 2.5 percentage points; contested shots lose 1 point.",
    tactics: ["perimeter", "pace"],
    training: "shooting",
    role: "shooter",
    effect: (c) => (c.contested ? -0.01 : 0.025),
    names: "hustle no-guard",
  },
  fresh: {
    description:
      "Above 75 energy, shot probability rises 1.5 percentage points.",
    tactics: ["pace"],
    training: "conditioning",
    role: "shooter",
    effect: (c) => (c.energy > 75 ? 0.015 : 0),
    names: "early-bird",
  },
} satisfies Record<string, Mechanic>;
export type AbilityMechanic = keyof typeof mechanics;
export interface SpeciesAbility {
  id: string;
  name: string;
  mechanic: AbilityMechanic;
  description: string;
  tactics: Tactic[];
  training: PlayerTrainingPlan["focus"];
}
const byName = new Map<string, AbilityMechanic>();
for (const [key, value] of Object.entries(mechanics)) {
  for (const name of value.names.split(" ")) {
    if (byName.has(name))
      throw new Error(`Duplicate ability adaptation: ${name}`);
    byName.set(name, key as AbilityMechanic);
  }
}
const bySpecies = new Map<number, SpeciesAbility>();
for (const [id, ability] of Object.entries(catalog)) {
  const mechanic = byName.get(ability.id);
  if (!mechanic)
    throw new Error(`Missing basketball adaptation: ${ability.id}`);
  const rule = mechanics[mechanic];
  bySpecies.set(Number(id), {
    ...ability,
    mechanic,
    description: rule.description,
    tactics: [...rule.tactics],
    training: rule.training,
  });
}
export function speciesAbility(pokemonId: number): SpeciesAbility {
  const ability = bySpecies.get(pokemonId);
  if (!ability) throw new Error(`Unknown ability species: ${pokemonId}`);
  return ability;
}
export function abilitiesEnabled(team: {
  abilityVersion?: 1;
  engineRules?: { abilities: boolean };
}) {
  return team.abilityVersion === 1 && team.engineRules?.abilities !== false;
}
export function abilityImpact(
  pokemonId: number,
  role: AbilityRole,
  context: AbilityContext,
  xp = 0,
): number {
  const rule = mechanics[speciesAbility(pokemonId).mechanic];
  return rule.role === role ? rule.effect(context) * masteryFactor(xp) : 0;
}
export function emptyAbilityActivations(): AbilityActivations {
  return { offense: 0, support: 0, defense: 0 };
}
export function addAbilityActivation(box: AbilityBox, role: AbilityRole) {
  const stats = (box.abilityActivations ??= emptyAbilityActivations());
  stats[
    role === "shooter" ? "offense" : role === "passer" ? "support" : "defense"
  ]++;
}
export function abilityTotal(box: AbilityBox): number {
  const a = box.abilityActivations;
  return a ? a.offense + a.support + a.defense : 0;
}
export function mergeAbilityActivations(
  target: AbilityBox,
  source: AbilityBox,
) {
  if (!source.abilityActivations) return;
  const stats = (target.abilityActivations ??= emptyAbilityActivations());
  for (const key of ["offense", "support", "defense"] as const)
    stats[key] += source.abilityActivations[key];
  if (source.abilityActivations.physical) {
    const physical = (stats.physical ??= {
      movement: 0,
      screens: 0,
      rebounds: 0,
      energySaved: 0,
    });
    for (const key of [
      "movement",
      "screens",
      "rebounds",
      "energySaved",
    ] as const)
      physical[key] =
        Math.round(
          (physical[key] + source.abilityActivations.physical[key]) * 1e6,
        ) / 1e6;
  }
}
export function validateAbilityActivations(raw: unknown): AbilityActivations {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid ability statistics.");
  const value = raw as Record<string, unknown>;
  const keys = ["offense", "support", "defense"] as const;
  if (
    Object.keys(value).some((k) => ![...keys, "physical"].includes(k)) ||
    keys.some(
      (k) =>
        !Number.isSafeInteger(value[k]) ||
        (value[k] as number) < 0 ||
        (value[k] as number) > 1_000_000_000,
    )
  )
    throw new Error("Invalid ability statistics.");
  let physical: PhysicalAbilityStats | undefined;
  if (value.physical !== undefined) {
    if (
      !value.physical ||
      typeof value.physical !== "object" ||
      Array.isArray(value.physical)
    )
      throw new Error("Invalid physical ability statistics.");
    const p = value.physical as Record<string, unknown>;
    const fields = ["movement", "screens", "rebounds", "energySaved"] as const;
    if (
      Object.keys(p).length !== 4 ||
      fields.some(
        (k) =>
          typeof p[k] !== "number" ||
          !Number.isFinite(p[k]) ||
          (p[k] as number) < 0 ||
          (p[k] as number) > 1e9,
      ) ||
      !Number.isSafeInteger(p.screens) ||
      !Number.isSafeInteger(p.rebounds)
    )
      throw new Error("Invalid physical ability statistics.");
    physical = Object.fromEntries(
      fields.map((k) => [k, p[k]]),
    ) as unknown as PhysicalAbilityStats;
  }
  return {
    offense: value.offense as number,
    support: value.support as number,
    defense: value.defense as number,
    ...(physical ? { physical } : {}),
  };
}
