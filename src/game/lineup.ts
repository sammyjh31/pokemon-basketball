import { POKEMON, POKEMON_BY_ID, POKEMON_COUNT } from "../data/pokemon";
import { nextRandom } from "./random";
import { ROSTER_SLOTS, type Roster } from "./types";

export function validRoster(
  value: Roster,
  includeLegends = true,
  maxSpeciesId = 251,
): boolean {
  if (!value || Object.keys(value).length !== 8) return false;
  const ids = ROSTER_SLOTS.map((position) => value[position]);
  const filled = ids.filter((id) => id !== null);
  return (
    new Set(filled).size === filled.length &&
    ids.every((id) => {
      if (id === null) return true;
      const mon = POKEMON_BY_ID.get(id);
      return !!mon && id <= maxSpeciesId && (includeLegends || !mon.legendary);
    })
  );
}

export function parseLineup(search: string): Roster | null {
  const source = new URLSearchParams(search).get("lineup");
  if (!source || !/^\d{1,3}(,\d{1,3}){4}(,\d{1,3}){0,3}$/.test(source))
    return null;
  const ids = source.split(",").map(Number);
  if (
    (ids.length !== 5 && ids.length !== 8) ||
    ids.some((id) => id > 251) ||
    ids.every((id) => id === 0)
  )
    return null;
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((p, i) => [p, ids[i] || null]),
  ) as Roster;
  return validRoster(roster) ? roster : null;
}

export function lineupLink(base: string, roster: Roster): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.search = `lineup=${ROSTER_SLOTS.map((p) => roster[p] ?? 0).join(",")}`;
  return url.toString();
}

export function randomLineup(includeLegends: boolean, seed: number): Roster {
  const pool = POKEMON.filter((mon) => includeLegends || !mon.legendary).map(
    (mon) => mon.id,
  );
  for (let i = pool.length - 1; i > 0; i--) {
    const random = nextRandom(seed);
    seed = random.seed;
    const j = Math.floor(random.value * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Object.fromEntries(ROSTER_SLOTS.map((p, i) => [p, pool[i]])) as Roster;
}
