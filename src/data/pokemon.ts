import data from "./pokemon.json";
import type { Pokemon } from "../game/types";
export const POKEMON: Pokemon[] = data.map((mon) => ({
  ...mon,
  spriteUrl: `/pokemon/${mon.id}.png`,
}));
export const POKEMON_COUNT = POKEMON.length;
export const POKEMON_BY_ID = new Map(POKEMON.map((mon) => [mon.id, mon]));
export const TYPES = [...new Set(POKEMON.flatMap((mon) => mon.types))].sort();
