import { POKEMON_BY_ID } from "../data/pokemon";
import {
  DEVELOPMENT_SKILLS,
  DEVELOPMENT_MIN,
  DEVELOPMENT_MAX,
  type DevelopmentRatings,
  type PlayerDevelopment,
} from "./developmentTypes";
import {
  BENCH_SLOTS,
  POSITIONS,
  ROSTER_SLOTS,
  type Pokemon,
  type Attributes,
  type Position,
  type Roster,
  type RosterSlot,
  type TeamRatings,
  type Tactic,
  type RotationStyle,
} from "./types";

export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Number.isNaN(n) ? min : n));
export const ATTRIBUTE_KEYS = [
  "shooting",
  "playmaking",
  "finishing",
  "perimeterDefense",
  "interiorDefense",
  "rebounding",
] as const;
export const DETAILED_ATTRIBUTE_KEYS = [
  "threePoint",
  "midRange",
  "freeThrow",
  "ballHandling",
  "passing",
  "speed",
  "strength",
  "stamina",
  "vertical",
  "steal",
  "block",
  "offensiveRebound",
  "defensiveRebound",
  "composure",
] as const;
export const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  shooting: "Shooting",
  playmaking: "Playmaking",
  finishing: "Finishing",
  perimeterDefense: "Perimeter defense",
  interiorDefense: "Interior defense",
  rebounding: "Rebounding",
  threePoint: "Three-point shot",
  midRange: "Midrange shot",
  freeThrow: "Free throw",
  ballHandling: "Ball handling",
  passing: "Passing",
  speed: "Court speed",
  strength: "Strength",
  stamina: "Stamina",
  vertical: "Vertical leap",
  steal: "Steal",
  block: "Shot blocking",
  offensiveRebound: "Offensive rebound",
  defensiveRebound: "Defensive rebound",
  composure: "Composure",
};

// Fictional basketball tendencies, averaged for dual types. No trait exceeds
// four points and traits never compound through other derived attributes.
const TYPE_TRAITS: Record<string, Partial<Attributes>> = {
  normal: { stamina: 2, composure: 1 },
  fire: { midRange: 3, finishing: 2, freeThrow: -1 },
  water: { stamina: 2, midRange: 2 },
  electric: { speed: 4, steal: 2, ballHandling: 2 },
  grass: { stamina: 3, passing: 1 },
  ice: { threePoint: 3, speed: -1 },
  fighting: { strength: 3, finishing: 3, freeThrow: -2 },
  poison: { steal: 3 },
  ground: { defensiveRebound: 3, strength: 2 },
  flying: { vertical: 4, block: 2 },
  psychic: { passing: 4, composure: 3 },
  bug: { stamina: 2, steal: 2, strength: -2 },
  rock: { strength: 4, block: 2, speed: -3 },
  ghost: { steal: 3, ballHandling: 2, strength: -2 },
  dragon: { strength: 2, passing: 2, finishing: 2 },
  dark: { steal: 3, ballHandling: 2, composure: -2 },
  steel: { block: 4, strength: 3, speed: -2 },
  fairy: { freeThrow: 3, composure: 3 },
};
const weighted = (
  a: Attributes,
  weights: Partial<Record<keyof Attributes, number>>,
) =>
  Object.entries(weights).reduce(
    (sum, [key, weight]) => sum + a[key as keyof Attributes] * weight,
    0,
  );
const average = (values: number[]) =>
  values.reduce((sum, n) => sum + n, 0) / (values.length || 1);
const topAverage = (values: number[], count: number) =>
  average([...values].sort((a, b) => b - a).slice(0, count));
const baseStat = (stat: number) =>
  (100 * (1 - Math.exp(-clamp(stat, 0, 200) / 100))) / (1 - Math.exp(-2));
const size = (value: number, cap: number) =>
  (100 * Math.log1p(clamp(value, 0, cap))) / Math.log1p(cap);

export function attributes(
  mon: Pokemon,
  offsets?: DevelopmentRatings,
): Attributes {
  const hp = baseStat(mon.stats.hp),
    attack = baseStat(mon.stats.attack),
    defense = baseStat(mon.stats.defense);
  const specialAttack = baseStat(mon.stats.specialAttack),
    specialDefense = baseStat(mon.stats.specialDefense),
    rawSpeed = baseStat(mon.stats.speed);
  const reach = size(mon.heightM, 3.5),
    mass = size(mon.weightKg, 350);
  const mobility = clamp(
    0.84 * rawSpeed +
      0.16 * specialDefense -
      0.24 * Math.max(0, mass - 55) -
      0.08 * Math.max(0, reach - 75),
  );
  const strength = 0.55 * attack + 0.18 * defense + 0.27 * mass;
  const vertical = clamp(
    0.6 * mobility + 0.4 * attack - 0.1 * Math.max(0, mass - 50),
  );
  const raw: Attributes = {
    threePoint: 0.67 * specialAttack + 0.23 * specialDefense + 0.1 * rawSpeed,
    midRange: 0.55 * specialAttack + 0.25 * specialDefense + 0.2 * rawSpeed,
    freeThrow: 0.32 * specialAttack + 0.56 * specialDefense + 0.12 * hp,
    ballHandling: clamp(
      0.58 * mobility +
        0.32 * specialAttack +
        0.1 * specialDefense -
        0.08 * Math.max(0, strength - 80),
    ),
    passing: 0.42 * specialAttack + 0.4 * specialDefense + 0.18 * mobility,
    speed: mobility,
    strength,
    stamina: clamp(
      0.54 * hp +
        0.23 * specialDefense +
        0.23 * rawSpeed -
        0.1 * Math.max(0, mass - 65),
    ),
    vertical,
    steal: 0.48 * mobility + 0.29 * specialDefense + 0.23 * defense,
    block: 0.42 * defense + 0.3 * reach + 0.28 * vertical,
    offensiveRebound:
      0.25 * hp + 0.25 * strength + 0.32 * reach + 0.18 * vertical,
    defensiveRebound:
      0.24 * hp + 0.25 * defense + 0.3 * reach + 0.21 * strength,
    composure: 0.65 * specialDefense + 0.2 * specialAttack + 0.15 * hp,
    finishing: 0.4 * attack + 0.2 * strength + 0.25 * vertical + 0.15 * reach,
    perimeterDefense: 0,
    interiorDefense: 0,
    shooting: 0,
    playmaking: 0,
    rebounding: 0,
  };
  for (const key of [...DETAILED_ATTRIBUTE_KEYS, "finishing"] as const) {
    const trait = average(
      [...new Set(mon.types)].map((type) => TYPE_TRAITS[type]?.[key] ?? 0),
    );
    raw[key] = clamp(raw[key] + trait);
  }
  raw.perimeterDefense = clamp(
    0.42 * raw.speed + 0.35 * defense + 0.23 * raw.steal,
  );
  raw.interiorDefense = clamp(
    0.4 * defense + 0.3 * raw.strength + 0.3 * raw.block,
  );
  // Defense is a trainable primitive too. Develop all primitives after the
  // factual-stat baseline, so speed/strength do not compound defense gains.
  if (offsets) {
    for (const key of DEVELOPMENT_SKILLS) {
      const offset = offsets[key] ?? 0;
      if (offset)
        raw[key] = clamp(
          raw[key] + clamp(offset, DEVELOPMENT_MIN, DEVELOPMENT_MAX),
        );
    }
  }
  // Summary skills are convex blends; modest type traits stay modest here too.
  raw.shooting =
    0.5 * raw.threePoint + 0.3 * raw.midRange + 0.2 * raw.freeThrow;
  raw.playmaking =
    0.5 * raw.passing + 0.35 * raw.ballHandling + 0.15 * raw.composure;
  raw.rebounding = 0.45 * raw.offensiveRebound + 0.55 * raw.defensiveRebound;
  return raw;
}

const POSITION_WEIGHTS: Record<
  Position,
  Partial<Record<keyof Attributes, number>>
> = {
  PG: {
    passing: 0.28,
    ballHandling: 0.25,
    threePoint: 0.12,
    perimeterDefense: 0.13,
    speed: 0.12,
    composure: 0.1,
  },
  SG: {
    threePoint: 0.29,
    midRange: 0.15,
    ballHandling: 0.16,
    finishing: 0.13,
    perimeterDefense: 0.17,
    speed: 0.1,
  },
  SF: {
    finishing: 0.23,
    threePoint: 0.17,
    perimeterDefense: 0.22,
    playmaking: 0.12,
    rebounding: 0.14,
    interiorDefense: 0.12,
  },
  PF: {
    finishing: 0.24,
    rebounding: 0.24,
    interiorDefense: 0.24,
    strength: 0.14,
    midRange: 0.08,
    passing: 0.06,
  },
  C: {
    interiorDefense: 0.29,
    defensiveRebound: 0.23,
    offensiveRebound: 0.15,
    finishing: 0.17,
    strength: 0.1,
    block: 0.06,
  },
};
const ROLE_REQUIREMENTS: Record<Position, (keyof Attributes)[]> = {
  PG: ["ballHandling", "passing", "speed"],
  SG: ["shooting", "ballHandling"],
  SF: ["perimeterDefense", "finishing"],
  PF: ["strength", "rebounding"],
  C: ["interiorDefense", "rebounding"],
};
export function positionRating(
  mon: Pokemon,
  position: Position,
  offsets?: DevelopmentRatings,
): number {
  const a = attributes(mon, offsets);
  // A weak essential skill cannot be hidden by an unrelated exceptional stat.
  return clamp(
    0.8 * weighted(a, POSITION_WEIGHTS[position]) +
      0.2 * Math.min(...ROLE_REQUIREMENTS[position].map((key) => a[key])),
  );
}
export function bestPosition(
  mon: Pokemon,
  offsets?: DevelopmentRatings,
): Position {
  return POSITIONS.reduce(
    (best, position) =>
      positionRating(mon, position, offsets) >
      positionRating(mon, best, offsets)
        ? position
        : best,
    "PG",
  );
}
function players(roster: Roster, development?: PlayerDevelopment) {
  return ROSTER_SLOTS.flatMap((slot) => {
    const mon = POKEMON_BY_ID.get(roster[slot] ?? -1);
    if (!mon) return [];
    const offsets = development?.[mon.id];
    const position = POSITIONS.includes(slot as Position)
      ? (slot as Position)
      : bestPosition(mon, offsets);
    return [
      {
        slot,
        mon,
        a: attributes(mon, offsets),
        fit: positionRating(mon, position, offsets),
        starter: POSITIONS.includes(slot as Position),
      },
    ];
  });
}

export function rotationMinutes(
  roster: Roster,
  rotation: RotationStyle = "balanced",
  development?: PlayerDevelopment,
): Record<RosterSlot, number> {
  const minutes = Object.fromEntries(
    ROSTER_SLOTS.map((slot) => [slot, 0]),
  ) as Record<RosterSlot, number>;
  const available = players(roster, development);
  if (!available.length) return minutes;
  const starterBase =
    rotation === "starters" ? 37 : rotation === "bench" ? 30 : 34;
  const reserveBase = (240 - starterBase * 5) / 3;
  const weights = available.map(
    (p) =>
      (p.starter ? starterBase : reserveBase) *
      (0.8 + p.fit / 250) *
      (0.85 + p.a.stamina / 400),
  );
  const target = Math.min(240, available.length * 36);
  // Highest-averages apportionment preserves exact integer totals and the cap.
  for (let i = 0; i < target; i++) {
    let selected = -1,
      priority = -1;
    available.forEach((p, index) => {
      if (minutes[p.slot] >= 40) return;
      const quotient = weights[index] / (minutes[p.slot] + 1);
      if (quotient > priority) {
        priority = quotient;
        selected = index;
      }
    });
    if (selected < 0) break;
    minutes[available[selected].slot]++;
  }
  return minutes;
}

export function teamRatings(
  roster: Roster,
  tactic: Tactic = "balanced",
  rotation: RotationStyle = "balanced",
  development?: PlayerDevelopment,
): TeamRatings {
  const available = players(roster, development),
    filled = available.filter((p) => p.starter).length;
  const empty = {
    offense: 0,
    defense: 0,
    overall: 0,
    filled,
    rosterFilled: available.length,
    complete: false,
    spacing: 0,
    creation: 0,
    rimProtection: 0,
    bench: 0,
    chemistry: 0,
  };
  if (!available.length) return empty;
  const minutes = rotationMinutes(roster, rotation, development),
    total = Object.values(minutes).reduce((sum, n) => sum + n, 0) || 1;
  const avg = (pick: (p: (typeof available)[number]) => number) =>
    available.reduce((sum, p) => sum + pick(p) * minutes[p.slot], 0) / total;
  const spacing =
    0.7 * avg((p) => p.a.threePoint) +
    0.3 *
      topAverage(
        available.map((p) => p.a.threePoint),
        3,
      );
  const creation =
    0.65 * avg((p) => p.a.playmaking) +
    0.35 *
      topAverage(
        available.map((p) => p.a.playmaking),
        2,
      );
  const rimProtection =
    0.5 * avg((p) => p.a.block) +
    0.5 *
      topAverage(
        available.map((p) => p.a.interiorDefense),
        2,
      );
  const coverage = Math.min(
    topAverage(
      available.map((p) => p.a.perimeterDefense),
      2,
    ),
    topAverage(
      available.map((p) => p.a.interiorDefense),
      2,
    ),
  );
  const chemistry = clamp(
    0.28 * spacing + 0.27 * creation + 0.25 * coverage + 0.2 * rimProtection,
  );
  const bench = average(
    available
      .filter((p) =>
        BENCH_SLOTS.includes(p.slot as (typeof BENCH_SLOTS)[number]),
      )
      .map((p) => p.fit),
  );
  const fatigue = (p: (typeof available)[number]) =>
    Math.max(0, minutes[p.slot] - (24 + 0.17 * p.a.stamina)) *
    (tactic === "pace" ? 0.55 : 0.38);
  let offense = avg(
    (p) =>
      0.75 *
        (0.3 * p.a.shooting + 0.32 * p.a.playmaking + 0.38 * p.a.finishing) +
      0.25 * p.fit -
      fatigue(p),
  );
  let defense = avg(
    (p) =>
      0.75 *
        (0.45 * p.a.perimeterDefense +
          0.32 * p.a.interiorDefense +
          0.23 * p.a.rebounding) +
      0.25 * p.fit -
      fatigue(p),
  );
  // Team needs amplify gaps by a few points, not by stacking large bonuses.
  offense +=
    clamp((spacing - 60) * 0.1, -6, 4) + clamp((creation - 60) * 0.1, -6, 4);
  defense +=
    clamp((coverage - 60) * 0.1, -6, 4) +
    clamp((rimProtection - 60) * 0.06, -4, 3);
  if (tactic === "perimeter") {
    offense += clamp((spacing - 55) * 0.15, -5, 5);
    defense -= 1.2;
  }
  if (tactic === "interior") {
    offense += clamp(
      (avg((p) => 0.65 * p.a.finishing + 0.35 * p.a.offensiveRebound) - 55) *
        0.15,
      -5,
      5,
    );
    defense -= 1;
  }
  if (tactic === "pace") {
    offense += clamp(
      (avg((p) => 0.6 * p.a.speed + 0.4 * p.a.stamina) - 55) * 0.15,
      -5,
      5,
    );
    defense -= 1.5;
  }
  if (tactic === "defense") {
    defense += 3;
    offense -= 2;
  }
  offense = clamp(offense);
  defense = clamp(defense);
  return {
    offense,
    defense,
    overall: (offense + defense) / 2,
    filled,
    rosterFilled: available.length,
    complete: filled === 5 && available.length === 8,
    spacing,
    creation,
    rimProtection,
    bench,
    chemistry,
  };
}
