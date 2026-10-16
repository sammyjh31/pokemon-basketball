import data from "./pokemon.json";
import rookieData from "./rookie-pokemon.json";
import type { Pokemon } from "../game/types";
export const POKEMON: Pokemon[] = data
  .filter((mon) => mon.id <= 251)
  .map((mon) => ({
    ...mon,
    spriteUrl: `/pokemon/${mon.id}.png`,
  }));
export const POKEMON_COUNT = POKEMON.length;
/** The initial league pool stays frozen; later species enter through rookie drafts. */
export const ROOKIE_POKEMON: (Pokemon & { generation: number })[] =
  rookieData.map((mon) => ({
    ...mon,
    spriteUrl: `/pokemon/${mon.id}.png`,
  }));
export const FRANCHISE_POKEMON: Pokemon[] = [...POKEMON, ...ROOKIE_POKEMON];
export const ROOKIE_GENERATIONS = [
  ...new Set(ROOKIE_POKEMON.map((mon) => mon.generation)),
].sort((a, b) => a - b);
export const LATEST_POKEMON_GENERATION = Math.max(...ROOKIE_GENERATIONS);
export const POKEMON_BY_ID = new Map(
  FRANCHISE_POKEMON.map((mon) => [mon.id, mon]),
);
export const TYPES = [...new Set(POKEMON.flatMap((mon) => mon.types))].sort();
