import { POKEMON_BY_ID } from "../data/pokemon";
import {
  POSITIONS,
  type Pokemon,
  type Attributes as FullAttributes,
  type Position,
  type Roster,
  type TeamRatings,
} from "./types";
type Attributes = Pick<
  FullAttributes,
  | "shooting"
  | "playmaking"
  | "finishing"
  | "perimeterDefense"
  | "interiorDefense"
  | "rebounding"
>;
export const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, n));
export const ATTRIBUTE_LABELS: Record<keyof Attributes, string> = {
  shooting: "Shooting",
  playmaking: "Playmaking",
  finishing: "Finishing",
  perimeterDefense: "Perimeter defense",
  interiorDefense: "Interior defense",
  rebounding: "Rebounding",
};
export const ATTRIBUTE_WEIGHTS: Record<
  keyof Attributes,
  Record<string, number>
> = {
  shooting: { specialAttack: 0.6, specialDefense: 0.25, speed: 0.15 },
  playmaking: { specialAttack: 0.45, speed: 0.4, specialDefense: 0.15 },
  finishing: { attack: 0.5, speed: 0.3, height: 0.2 },
  perimeterDefense: { speed: 0.45, defense: 0.3, specialDefense: 0.25 },
  interiorDefense: { defense: 0.45, hp: 0.25, height: 0.15, weight: 0.15 },
  rebounding: { hp: 0.25, defense: 0.25, height: 0.3, weight: 0.2 },
};
export const ATTRIBUTE_KEYS = Object.keys(
  ATTRIBUTE_WEIGHTS,
) as (keyof Attributes)[];
export const POSITION_WEIGHTS: Record<Position, number[]> = {
  PG: [0.2, 0.45, 0.1, 0.2, 0, 0.05],
  SG: [0.45, 0.15, 0.2, 0.15, 0, 0.05],
  SF: [0.25, 0.15, 0.25, 0.15, 0.1, 0.1],
  PF: [0.1, 0.05, 0.3, 0.05, 0.2, 0.3],
  C: [0.05, 0.05, 0.2, 0.05, 0.35, 0.3],
};
export function attributes(mon: Pokemon): Attributes {
  const values: Record<string, number> = Object.fromEntries(
    Object.entries(mon.stats).map(([k, v]) => [k, clamp((100 * v) / 160)]),
  );
  values.height = clamp((100 * Math.log1p(mon.heightM)) / Math.log(4));
  values.weight = clamp((100 * Math.log1p(mon.weightKg)) / Math.log(251));
  return Object.fromEntries(
    ATTRIBUTE_KEYS.map((k) => [
      k,
      clamp(
        Object.entries(ATTRIBUTE_WEIGHTS[k]).reduce(
          (sum, [key, w]) => sum + values[key] * w,
          0,
        ),
      ),
    ]),
  ) as unknown as Attributes;
}
export function positionRating(mon: Pokemon, position: Position): number {
  const a = attributes(mon);
  return ATTRIBUTE_KEYS.reduce(
    (sum, key, i) => sum + a[key] * POSITION_WEIGHTS[position][i],
    0,
  );
}
export function teamRatings(roster: Roster): TeamRatings {
  let offense = 0,
    defense = 0,
    filled = 0;
  for (const position of POSITIONS) {
    const mon = POKEMON_BY_ID.get(roster[position] ?? -1);
    if (!mon) continue;
    const a = attributes(mon),
      fit = positionRating(mon, position);
    filled++;
    offense +=
      0.75 * (0.35 * a.shooting + 0.3 * a.playmaking + 0.35 * a.finishing) +
      0.25 * fit;
    defense +=
      0.75 *
        (0.4 * a.perimeterDefense +
          0.35 * a.interiorDefense +
          0.25 * a.rebounding) +
      0.25 * fit;
  }
  offense /= filled || 1;
  defense /= filled || 1;
  return {
    offense,
    defense,
    overall: (offense + defense) / 2,
    filled,
    complete: filled === 5,
  };
}
