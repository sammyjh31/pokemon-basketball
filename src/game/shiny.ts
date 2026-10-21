import type { Pokemon } from "./types";

export const SHINY_ODDS = 1024;
export const SHINY_SKILL_BONUS = 3;
export const validShinySeed = (seed: unknown): seed is number =>
  typeof seed === "number" &&
  Number.isInteger(seed) &&
  seed >= 0 &&
  seed <= 0xffffffff;

/** A species keeps one variant throughout its league; viewing or refreshing never rerolls it. */
export function isShinyPokemon(pokemonId: number, seed?: number): boolean {
  if (
    !validShinySeed(seed) ||
    !Number.isInteger(pokemonId) ||
    pokemonId < 1 ||
    pokemonId > 1025
  )
    return false;
  let hash = (seed ^ Math.imul(pokemonId, 0x9e3779b9)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b);
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35);
  return ((hash ^ (hash >>> 16)) >>> 0) % SHINY_ODDS === 0;
}
const variants = new WeakMap<Pokemon, Pokemon>();
export function shinyPokemon(mon: Pokemon, seed?: number): Pokemon {
  if (mon.shiny || !isShinyPokemon(mon.id, seed)) return mon;
  let variant = variants.get(mon);
  if (!variant) {
    variant = { ...mon, shiny: true };
    variants.set(mon, variant);
  }
  return variant;
}
