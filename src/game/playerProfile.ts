import { attributes, clamp, positionRating } from "./ratings";
import {
  POSITIONS,
  type Attributes,
  type Pokemon,
  type Position,
} from "./types";

export interface PlayerTraits {
  screening: number;
  offBall: number;
  postGame: number;
  switchability: number;
  discipline: number;
  usage: number;
  drawFoul: number;
  closeout: number;
  decisionMaking: number;
}

export const PROFILE_LABELS: Record<keyof PlayerTraits, string> = {
  screening: "Screen setting",
  offBall: "Off-ball movement",
  postGame: "Post scoring",
  switchability: "Switch defense",
  discipline: "Foul discipline",
  usage: "Scoring initiative",
  drawFoul: "Drawing contact",
  closeout: "Closeouts",
  decisionMaking: "Decision making",
};

export interface PlayerProfile {
  attributes: Attributes;
  positions: Record<Position, number>;
  bestPosition: Position;
  archetype: string;
  traits: PlayerTraits;
  strengths: string[];
  weaknesses: string[];
  scouting: string;
}

// Profiles contain no match state. Object identity avoids stale data when a
// caller supplies a different Pokémon with the same species id.
const profiles = new WeakMap<Pokemon, PlayerProfile>();

export function playerProfile(mon: Pokemon): PlayerProfile {
  const cached = profiles.get(mon);
  if (cached) return cached;
  const a = attributes(mon);
  const positions = Object.fromEntries(
    POSITIONS.map((p) => [p, positionRating(mon, p)]),
  ) as Record<Position, number>;
  const bestPosition = POSITIONS.reduce(
    (best, p) => (positions[p] > positions[best] ? p : best),
    "PG",
  );
  const traits: PlayerTraits = {
    screening: clamp(
      a.strength * 0.48 + a.composure * 0.24 + a.offensiveRebound * 0.28,
    ),
    offBall: clamp(
      a.speed * 0.32 +
        a.threePoint * 0.3 +
        a.stamina * 0.18 +
        a.composure * 0.2,
    ),
    postGame: clamp(
      a.strength * 0.38 +
        a.finishing * 0.36 +
        a.midRange * 0.12 +
        a.composure * 0.14,
    ),
    switchability: clamp(
      Math.min(a.perimeterDefense, a.interiorDefense) * 0.5 +
        a.speed * 0.24 +
        a.strength * 0.12 +
        a.composure * 0.14,
    ),
    discipline: clamp(
      a.composure * 0.58 + a.perimeterDefense * 0.2 + a.interiorDefense * 0.22,
    ),
    usage: clamp(
      a.ballHandling * 0.27 +
        a.finishing * 0.28 +
        a.shooting * 0.28 +
        a.composure * 0.17,
    ),
    drawFoul: clamp(
      a.finishing * 0.36 +
        a.ballHandling * 0.23 +
        a.strength * 0.22 +
        a.speed * 0.19,
    ),
    closeout: clamp(
      a.speed * 0.4 +
        a.perimeterDefense * 0.34 +
        a.vertical * 0.16 +
        a.composure * 0.1,
    ),
    decisionMaking: clamp(
      a.passing * 0.43 + a.composure * 0.4 + a.ballHandling * 0.17,
    ),
  };
  const roles: [string, number][] = [
    [
      "Floor general",
      a.passing * 0.55 + a.ballHandling * 0.3 + a.composure * 0.15,
    ],
    [
      "Perimeter scorer",
      a.threePoint * 0.55 + a.midRange * 0.25 + traits.offBall * 0.2,
    ],
    [
      "Downhill creator",
      a.finishing * 0.45 + a.speed * 0.3 + a.ballHandling * 0.25,
    ],
    [
      "Post anchor",
      traits.postGame * 0.5 + a.rebounding * 0.25 + a.interiorDefense * 0.25,
    ],
    [
      "Defensive stopper",
      a.perimeterDefense * 0.45 + a.interiorDefense * 0.3 + a.steal * 0.25,
    ],
    [
      "Rim protector",
      a.block * 0.45 + a.defensiveRebound * 0.3 + a.interiorDefense * 0.25,
    ],
  ];
  roles.sort((x, y) => y[1] - x[1]);
  const ranked = (Object.keys(traits) as (keyof PlayerTraits)[]).sort(
    (x, y) => traits[y] - traits[x],
  );
  const strengths = ranked.slice(0, 3).map((key) => PROFILE_LABELS[key]);
  const weaknesses = ranked
    .slice(-2)
    .reverse()
    .map((key) => PROFILE_LABELS[key]);
  const profile: PlayerProfile = {
    attributes: a,
    positions,
    bestPosition,
    traits,
    archetype: roles[0][0],
    strengths,
    weaknesses,
    scouting: `${roles[0][0]} with a natural fit at ${bestPosition}. Best tools: ${strengths.slice(0, 2).join(" and ").toLowerCase()}. Relative development areas: ${weaknesses.join(" and ").toLowerCase()}.`,
  };
  profiles.set(mon, profile);
  return profile;
}
