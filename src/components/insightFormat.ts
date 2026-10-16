import { POKEMON_BY_ID } from "../data/pokemon";
export const insightPlayerName = (id: string) => {
  const pokemonId = Number(id.split(":").at(-1));
  return POKEMON_BY_ID.get(pokemonId)?.name ?? `#${pokemonId}`;
};
export const insightNumber = (value: number | null, decimals = 1) =>
  value === null || !Number.isFinite(value) ? "—" : value.toFixed(decimals);
