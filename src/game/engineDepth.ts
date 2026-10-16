import { clamp } from "./ratings";
import type { PlayerProfile } from "./playerProfile";
import type { PlayType, Pokemon } from "./types";

export type SignatureId =
  | "burst"
  | "range"
  | "contact"
  | "vision"
  | "anchor"
  | "pressure"
  | "poise"
  | "spring";
export interface EngineProfile {
  physical: {
    /** Normalized reach, 0..1. Other fields are additive attribute points except fatigue. */
    reach: number;
    rebounding: number;
    screening: number;
    postContact: number;
    agility: number;
    /** Extra energy drain per minute; largest bodies pay up to 0.28. */
    fatigue: number;
  };
  tendencies: {
    usage: number;
    rim: number;
    mid: number;
    three: number;
    passing: number;
    description: string;
  };
  signature: { id: SignatureId; name: string; description: string };
  scouting: string;
}
const signatures: Record<SignatureId, EngineProfile["signature"]> = {
  burst: {
    id: "burst",
    name: "Quick first step",
    description: "+1.2 percentage points on transition shots.",
  },
  range: {
    id: "range",
    name: "Set-shot rhythm",
    description: "+1.2 percentage points on spot-up threes.",
  },
  contact: {
    id: "contact",
    name: "Strong finish",
    description: "+1.2 percentage points on post shots at the rim.",
  },
  vision: {
    id: "vision",
    name: "Passing vision",
    description:
      "+0.8 percentage points for a teammate after a pick-and-roll or spot-up pass.",
  },
  anchor: {
    id: "anchor",
    name: "Paint anchor",
    description:
      "Lowers opposing rim accuracy by 1 percentage point while energy is above 40.",
  },
  pressure: {
    id: "pressure",
    name: "Closeout specialist",
    description:
      "Lowers contested perimeter accuracy by 0.8 percentage points.",
  },
  poise: {
    id: "poise",
    name: "Steady hands",
    description: "+1.2 percentage points on clutch shots.",
  },
  spring: {
    id: "spring",
    name: "Second jump",
    description: "+1.2 percentage points on second-chance rim shots.",
  },
};
const signatureTypes: Record<string, SignatureId> = {
  normal: "poise",
  fire: "contact",
  water: "vision",
  electric: "burst",
  grass: "vision",
  ice: "range",
  fighting: "contact",
  poison: "pressure",
  ground: "anchor",
  flying: "spring",
  psychic: "vision",
  bug: "spring",
  rock: "anchor",
  ghost: "pressure",
  dragon: "contact",
  dark: "pressure",
  steel: "anchor",
  fairy: "poise",
};
const fraction = (id: number, salt: number) => {
  let hash = Math.imul(id ^ salt, 2654435761) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 2246822507) >>> 0;
  return (hash % 1001) / 1000;
};
const cache = new WeakMap<Pokemon, EngineProfile>();
/** Supplemental, bounded game tuning. Species identity sets preferences independently of skill. */
export function engineProfile(mon: Pokemon): EngineProfile {
  const prior = cache.get(mon);
  if (prior) return prior;
  const reach = Math.tanh(Math.log1p(clamp(mon.heightM, 0, 1000)) / 1.8);
  const mass = Math.tanh(
    Math.log(Math.max(0.1, clamp(mon.weightKg, 0, 100000)) / 80) / 2.2,
  );
  const physical = {
    reach,
    rebounding: 4 * reach + 2 * mass,
    screening: 5 * mass,
    postContact: 4 * mass,
    agility: -4 * Math.max(0, mass) - 1.5 * reach,
    fatigue: 0.24 * Math.max(0, mass) + 0.04 * reach,
  };
  const tendencies = {
    usage: 0.88 + fraction(mon.id, 17) * 0.24,
    rim: clamp(0.8 + fraction(mon.id, 31) * 0.4, 0.8, 1.2),
    mid: clamp(0.8 + fraction(mon.id, 43) * 0.4, 0.8, 1.2),
    three: clamp(0.8 + fraction(mon.id, 59) * 0.4, 0.8, 1.2),
    passing: 0.9 + fraction(mon.id, 71) * 0.2,
    description: "",
  };
  const preferred = (["rim", "mid", "three"] as const).reduce(
    (best, zone) => (tendencies[zone] > tendencies[best] ? zone : best),
    "rim",
  );
  tendencies.description = `${tendencies.usage > 1.03 ? "Assertive" : tendencies.usage < 0.97 ? "Selective" : "Balanced"} usage; prefers ${preferred === "rim" ? "rim attacks" : preferred === "mid" ? "midrange looks" : "three-point looks"}. Preferences shape choices, not accuracy.`;
  const signature = signatures[signatureTypes[mon.types[0]] ?? "poise"];
  const profile = {
    physical,
    tendencies,
    signature,
    scouting: `${mon.heightM} m / ${mon.weightKg} kg. ${mass > 0.25 ? "Mass adds screens and contact finishing, with slower movement and more fatigue." : "Lighter frame keeps movement costs low but offers less screening leverage."} Reach and rebounding benefits have diminishing returns. ${tendencies.description} Signature: ${signature.name}.`,
  };
  cache.set(mon, profile);
  return profile;
}

/** Separate players must provide creation, spacing and finishing; no single star fills all three roles. */
export function lineupChemistry(
  profiles: PlayerProfile[],
  familiarity: number,
): number {
  let complement = 0;
  for (let passer = 0; passer < profiles.length; passer++)
    for (let spacer = 0; spacer < profiles.length; spacer++)
      for (let finisher = 0; finisher < profiles.length; finisher++) {
        if (passer === spacer || spacer === finisher || passer === finisher)
          continue;
        const creation = clamp(
          (profiles[passer].attributes.passing - 40) / 60,
          0,
          1,
        );
        const space = clamp(
          (profiles[spacer].attributes.threePoint - 40) / 60,
          0,
          1,
        );
        const finish = clamp(
          (profiles[finisher].attributes.finishing - 40) / 60,
          0,
          1,
        );
        complement = Math.max(complement, Math.cbrt(creation * space * finish));
      }
  return complement * 0.01 + clamp(familiarity, 0, 1) * 0.006;
}

export interface SignatureContext {
  zone: "rim" | "mid" | "three";
  play: PlayType;
  clutch: boolean;
  secondChance: boolean;
  contested: boolean;
  energy: number;
}
/** At most 1.2 pp from a shooter, 0.8 pp from a passer, 1 pp from a defender. */
export function signatureImpact(
  profile: EngineProfile,
  role: "shooter" | "passer" | "defender",
  context: SignatureContext,
  enabled: boolean,
): number {
  if (!enabled) return 0;
  const id = profile.signature.id;
  if (role === "passer")
    return id === "vision" &&
      (context.play === "pickRoll" || context.play === "spotUp")
      ? 0.008
      : 0;
  if (role === "defender") {
    if (id === "anchor" && context.zone === "rim" && context.energy > 40)
      return -0.01;
    if (id === "pressure" && context.zone !== "rim" && context.contested)
      return -0.008;
    return 0;
  }
  const active =
    (id === "burst" && context.play === "transition") ||
    (id === "range" && context.play === "spotUp" && context.zone === "three") ||
    (id === "contact" && context.play === "post" && context.zone === "rim") ||
    (id === "poise" && context.clutch) ||
    (id === "spring" && context.secondChance && context.zone === "rim");
  return active ? 0.012 : 0;
}
