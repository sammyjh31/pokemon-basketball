import { ALL_POKEMON, POKEMON } from "../data/pokemon";

export type DraftPool = "all" | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const DRAFT_GENERATIONS = [
  { id: 1, name: "Generation I · Kanto", first: 1, last: 151 },
  { id: 2, name: "Generation II · Johto", first: 152, last: 251 },
  { id: 3, name: "Generation III · Hoenn", first: 252, last: 386 },
  { id: 4, name: "Generation IV · Sinnoh", first: 387, last: 493 },
  { id: 5, name: "Generation V · Unova", first: 494, last: 649 },
  { id: 6, name: "Generation VI · Kalos", first: 650, last: 721 },
  { id: 7, name: "Generation VII · Alola", first: 722, last: 809 },
] as const;
export const isDraftPool = (value: unknown): value is DraftPool =>
  value === "all" ||
  (typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 7);

export function inDraftPool(pool: DraftPool | undefined, id: number): boolean {
  if (!Number.isInteger(id) || id < 1) return false;
  if (pool === undefined) return id <= 251;
  if (pool === "all") return id <= 809;
  const generation = DRAFT_GENERATIONS.find((g) => g.id === pool);
  return !!generation && id >= generation.first && id <= generation.last;
}

/** Omitted selections retain the original Gen I–II replay inputs. */
export function draftPokemon(pool: DraftPool | undefined) {
  if (pool === undefined) return POKEMON;
  if (!isDraftPool(pool)) throw new Error("Unknown Pokémon draft pool.");
  return pool === "all"
    ? ALL_POKEMON
    : ALL_POKEMON.filter((p) => inDraftPool(pool, p.id));
}
export const draftPoolLabel = (pool: DraftPool | undefined): string =>
  pool === undefined
    ? "Generations I–II (saved pool)"
    : pool === "all"
      ? "All seven generations"
      : DRAFT_GENERATIONS.find((g) => g.id === pool)!.name;
