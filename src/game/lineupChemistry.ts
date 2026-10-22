import { pairKey, pairBond, type PairBonds } from "./teammateChemistry";
import { speciesAbility, type AbilityMechanic } from "./abilities";
import type { PlayerProfile } from "./playerProfile";
import { clamp } from "./ratings";
import type { DefenseScheme, Tactic } from "./types";
import type { TeamLeadership } from "./playerPersonality";

export interface ChemistryPlayer {
  pokemonId: number;
  profile: PlayerProfile;
}
export interface ChemistryContext {
  tactic: Tactic;
  defense: DefenseScheme;
  abilities: boolean;
  familiarity?: number;
  bonds?: PairBonds;
  /** Frozen pregame scores; only members of this active five contribute. */
  morale?: Record<number, number>;
  leadership?: TeamLeadership;
}
export interface ChemistryEffects {
  passing: number;
  movement: number;
  screen: number;
  navigation: number;
  rebound: number;
  drain: number;
  defense: number;
}
export interface ChemistryLink {
  id: string;
  label: string;
  pokemonIds: number[];
  description: string;
}
export interface LineupChemistry {
  leadership?: {
    captainId: number;
    style: TeamLeadership["style"];
    active: boolean;
    cohesionDelta: number;
  };
  morale?: { score: number; cohesionDelta: number };
  skillScore?: number;
  continuity?: {
    score: number;
    sharedMinutes: number;
    pairs: { pokemonIds: [number, number]; minutes: number; bond: number }[];
  };
  score: number;
  value: number;
  strengths: string[];
  weaknesses: string[];
  links: ChemistryLink[];
  effects: Record<number, ChemistryEffects>;
}
export const NEUTRAL_CHEMISTRY_EFFECTS: Readonly<ChemistryEffects> =
  Object.freeze({
    passing: 1,
    movement: 1,
    screen: 1,
    navigation: 1,
    rebound: 1,
    drain: 1,
    defense: 1,
  });
export function chemistryEnabled(team: { chemistryVersion?: 1 }): boolean {
  return team.chemistryVersion === 1;
}
const fields = Object.keys(
  NEUTRAL_CHEMISTRY_EFFECTS,
) as (keyof ChemistryEffects)[];
const quality = (n: number) => clamp(n / 100, 0, 1);
const average = (xs: number[]) =>
  xs.length ? xs.reduce((n, x) => n + x, 0) / xs.length : 0;
const topTwo = (xs: number[]) =>
  average([...xs].sort((a, b) => b - a).slice(0, 2));
interface Candidate {
  link: ChemistryLink;
  bonuses: Record<number, Partial<ChemistryEffects>>;
}

/** Only the active five contribute. Ability adaptations are basketball mechanics, not Pokémon battle rules. */
export function evaluateLineupChemistry(
  input: readonly ChemistryPlayer[],
  context: ChemistryContext,
): LineupChemistry {
  if (
    input.length > 5 ||
    new Set(input.map((p) => p.pokemonId)).size !== input.length
  )
    throw new Error("Chemistry requires at most five distinct active Pokémon.");
  const players = [...input].sort((a, b) => a.pokemonId - b.pokemonId);
  const effects: Record<number, ChemistryEffects> = Object.fromEntries(
    players.map((p) => [p.pokemonId, { ...NEUTRAL_CHEMISTRY_EFFECTS }]),
  );
  // Draft previews can have incomplete rosters; no imaginary teammates fill the gaps.
  if (players.length !== 5)
    return {
      score: 50,
      value: 0,
      strengths: [],
      weaknesses: ["Complete the five-player unit to evaluate chemistry."],
      links: [],
      effects,
    };
  // Roots are monotonic: compare the same products first, then take each root once.
  // Keep multiplication order unchanged so seeded game outcomes remain identical.
  const skills = players.map(({ profile: { attributes: a } }) => ({
    creation: quality((a.passing + a.ballHandling) / 2),
    threePoint: quality(a.threePoint),
    finishing: quality(a.finishing),
    perimeterDefense: quality(a.perimeterDefense),
    interiorDefense: quality(a.interiorDefense),
  }));
  let triangleProduct = 0,
    defenseProduct = 0;
  for (const creator of skills)
    for (const spacer of skills) {
      if (creator === spacer) continue;
      defenseProduct = Math.max(
        defenseProduct,
        creator.perimeterDefense * spacer.interiorDefense,
      );
      for (const finisher of skills) {
        if (finisher === creator || finisher === spacer) continue;
        triangleProduct = Math.max(
          triangleProduct,
          creator.creation * spacer.threePoint * finisher.finishing,
        );
      }
    }
  const triangle = Math.cbrt(triangleProduct),
    defensePair = Math.sqrt(defenseProduct);
  const spacing = topTwo(
      players.map((p) => quality(p.profile.attributes.threePoint)),
    ),
    poise = average(
      players.map((p) => quality(p.profile.attributes.composure)),
    ),
    // Earned pair history replaces the older coarse local continuity bonus.
    familiarity =
      context.bonds === undefined ? clamp(context.familiarity ?? 0, 0, 1) : 0;
  const skillScore = clamp(
    (triangle * 0.35 + spacing * 0.2 + defensePair * 0.25 + poise * 0.2) * 100 +
      familiarity * 4,
    0,
    100,
  );
  const pairs =
    context.bonds === undefined
      ? undefined
      : players.flatMap((a, i) =>
          players.slice(i + 1).map((b) => {
            const minutes =
              context.bonds![pairKey(a.pokemonId, b.pokemonId)] ?? 0;
            return {
              pokemonIds: [a.pokemonId, b.pokemonId] as [number, number],
              minutes,
              bond: pairBond(minutes),
            };
          }),
        );
  const learnedFamiliarity = pairs ? average(pairs.map((p) => p.bond)) : 0;
  const continuity = pairs
    ? {
        score: learnedFamiliarity * 100,
        sharedMinutes: average(pairs.map((p) => p.minutes)),
        pairs,
      }
    : undefined;
  const morale =
    context.morale === undefined
      ? undefined
      : {
          score: average(
            players.map((p) =>
              clamp(context.morale?.[p.pokemonId] ?? 50, 0, 100),
            ),
          ),
          cohesionDelta: 0,
        };
  if (morale) morale.cohesionDelta = clamp((morale.score - 50) * 0.08, -4, 4);
  const captainActive =
    context.leadership !== undefined &&
    players.some((p) => p.pokemonId === context.leadership!.captainId);
  const leadership = context.leadership
    ? {
        captainId: context.leadership.captainId,
        style: context.leadership.style,
        active: captainActive,
        cohesionDelta: captainActive
          ? clamp(context.leadership.cohesionBonus, -2, 2)
          : 0,
      }
    : undefined;
  const score = clamp(
    skillScore +
      learnedFamiliarity * 6 +
      (morale?.cohesionDelta ?? 0) +
      (leadership?.cohesionDelta ?? 0),
    0,
    100,
  );
  const coordination = clamp((score - 60) / 40, -1, 1);
  const base: ChemistryEffects = {
    ...NEUTRAL_CHEMISTRY_EFFECTS,
    passing: 1 + coordination * 0.025,
    screen: 1 + coordination * 0.02,
    defense: 1 + coordination * 0.015,
  };
  for (const p of players) effects[p.pokemonId] = { ...base };
  const strengths: string[] = [],
    weaknesses: string[] = [];
  for (const [value, label] of [
    [triangle, "Distinct creators, spacers and finishers"],
    [spacing, "Shooting depth"],
    [defensePair, "Perimeter and interior coverage"],
    [poise, "Composure and coordination"],
  ] as const)
    (value >= 0.65 ? strengths : value < 0.55 ? weaknesses : []).push(label);
  const candidates: Candidate[] = [];
  if (context.abilities) {
    const entries = players.map((p) => ({
      ...p,
      ability: speciesAbility(p.pokemonId),
    }));
    const add = (
      kind: string,
      label: string,
      a: ChemistryPlayer,
      b: ChemistryPlayer,
      description: string,
      da: Partial<ChemistryEffects>,
      db: Partial<ChemistryEffects>,
    ) => {
      const learned =
        context.bonds === undefined
          ? 1
          : 1 +
            0.25 *
              pairBond(context.bonds[pairKey(a.pokemonId, b.pokemonId)] ?? 0);
      const scale = (delta: Partial<ChemistryEffects>) =>
        learned === 1
          ? delta
          : Object.fromEntries(
              Object.entries(delta).map(([k, v]) => [k, v * learned]),
            );
      candidates.push({
        link: {
          id: `${kind}:${a.pokemonId}:${b.pokemonId}`,
          label,
          pokemonIds: [a.pokemonId, b.pokemonId],
          description,
        },
        bonuses: {
          [a.pokemonId]: scale(da),
          [b.pokemonId]: scale(db),
        },
      });
    };
    const inGroup = (mechanic: AbilityMechanic, group: AbilityMechanic[]) =>
      group.includes(mechanic);
    for (const a of entries)
      for (const b of entries) {
        if (a === b) continue;
        const aa = a.profile.attributes,
          ba = b.profile.attributes,
          am = a.ability.mechanic,
          bm = b.ability.mechanic;
        if (
          inGroup(am, ["creator", "support"]) &&
          inGroup(bm, ["aerial", "power"])
        ) {
          const q =
            Math.sqrt(quality(aa.passing) * quality(ba.finishing)) *
            (context.tactic === "interior" || context.tactic === "balanced"
              ? 1
              : 0.8);
          add(
            "creator-finisher",
            "Creator + finisher",
            a,
            b,
            "The creator improves passing timing while the finisher gains movement and screen timing.",
            { passing: 0.04 * q },
            { movement: 0.03 * q, screen: 0.03 * q },
          );
        }
        if (
          inGroup(am, ["armor", "power", "intimidate"]) &&
          inGroup(bm, ["range", "focus", "gamble", "craft"])
        ) {
          const q =
            Math.sqrt(
              quality(a.profile.traits.screening) * quality(ba.threePoint),
            ) *
            (context.tactic === "perimeter" || context.tactic === "balanced"
              ? 1
              : 0.8);
          add(
            "screen-space",
            "Screen + space",
            a,
            b,
            "A sturdy screen and a shooting threat coordinate contact and movement to create room.",
            { screen: 0.04 * q },
            { movement: 0.03 * q },
          );
        }
        if (
          inGroup(am, ["armor", "intimidate"]) &&
          inGroup(bm, ["perimeter", "evasion"])
        ) {
          const q =
            Math.sqrt(
              quality(aa.interiorDefense) * quality(ba.perimeterDefense),
            ) *
            (context.defense === "zone" || context.defense === "switch"
              ? 1
              : 0.85);
          add(
            "defensive-chain",
            "Pressure + anchor",
            a,
            b,
            "The paint anchor and perimeter disruptor coordinate coverage and screen navigation.",
            { defense: 0.035 * q },
            { defense: 0.035 * q, navigation: 0.025 * q },
          );
        }
        if (
          inGroup(am, ["cleanup", "aerial", "armor"]) &&
          inGroup(bm, ["tempo", "creator"])
        ) {
          const q =
            Math.sqrt(quality(aa.defensiveRebound) * quality(ba.speed)) *
            (context.tactic === "pace" ? 1 : 0.8);
          add(
            "outlet",
            "Rebound + outlet",
            a,
            b,
            "The rebounder pursues the ball and prepares the outlet while a teammate runs ahead.",
            { rebound: 0.035 * q, passing: 0.025 * q },
            { movement: 0.03 * q },
          );
        }
        if (
          inGroup(am, ["endurance", "support"]) &&
          inGroup(bm, ["tempo", "surge", "momentum", "fresh"])
        ) {
          const q =
            Math.sqrt(quality(aa.stamina) * quality(ba.speed)) *
            (context.tactic === "pace" || context.defense === "press"
              ? 1
              : 0.85);
          add(
            "second-wind",
            "Second wind",
            a,
            b,
            "A resilient teammate supports the runner's workload; both conserve on-court energy.",
            { drain: -0.015 * q },
            { drain: -0.035 * q },
          );
        }
        if (a.ability.id === "plus" && b.ability.id === "minus") {
          const q = Math.sqrt(quality(aa.passing) * quality(ba.passing));
          add(
            "plus-minus",
            "Plus / Minus",
            a,
            b,
            "Complementary signals improve both partners' passing and off-ball movement.",
            { passing: 0.04 * q, movement: 0.035 * q },
            { passing: 0.04 * q, movement: 0.035 * q },
          );
        }
      }
  }
  // Each recipient/effect uses one strongest source. Report only links that actually supply a modifier.
  const active = new Set<Candidate>();
  for (const player of players)
    for (const key of fields) {
      let best: Candidate | undefined,
        delta = 0;
      for (const candidate of candidates) {
        const offered = candidate.bonuses[player.pokemonId]?.[key] ?? 0;
        if (Math.abs(offered) > Math.abs(delta)) {
          best = candidate;
          delta = offered;
        }
      }
      if (best && delta !== 0) {
        active.add(best);
        effects[player.pokemonId][key] = clamp(
          base[key] + delta,
          key === "drain" ? 0.94 : 0.96,
          key === "drain" ? 1 : 1.08,
        );
      }
    }
  const weights: ChemistryEffects = {
    passing: 20,
    movement: 24,
    screen: 16,
    navigation: 12,
    rebound: 20,
    drain: 24,
    defense: 24,
  };
  const synergyValue = average(
    players.map((p) =>
      fields.reduce(
        (n, key) =>
          n + Math.abs(effects[p.pokemonId][key] - base[key]) * weights[key],
        0,
      ),
    ),
  );
  return {
    score,
    ...(morale ? { morale } : {}),
    ...(leadership ? { leadership } : {}),
    ...(continuity ? { skillScore, continuity } : {}),
    value: clamp(
      coordination * 2 + synergyValue + learnedFamiliarity * 1.5,
      -2,
      5,
    ),
    strengths,
    weaknesses,
    links: candidates.filter((c) => active.has(c)).map((c) => c.link),
    effects,
  };
}
