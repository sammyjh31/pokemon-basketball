import { POKEMON, POKEMON_BY_ID } from "../data/pokemon";
import { nextRandom } from "./random";
import { POSITIONS, type Roster } from "./types";

export function validRoster(value: Roster, includeLegends = true): boolean {
  if (!value || Object.keys(value).length !== 5) return false;
  const ids = POSITIONS.map((position) => value[position]);
  const filled = ids.filter((id) => id !== null);
  return (
    new Set(filled).size === filled.length &&
    ids.every((id) => {
      if (id === null) return true;
      const mon = POKEMON_BY_ID.get(id);
      return !!mon && (includeLegends || !mon.legendary);
    })
  );
}

export function parseLineup(search: string): Roster | null {
  const source = new URLSearchParams(search).get("lineup");
  if (!source || !/^\d{1,3}(,\d{1,3}){4}$/.test(source)) return null;
  const ids = source.split(",").map(Number);
  const roster = Object.fromEntries(
    POSITIONS.map((p, i) => [p, ids[i] || null]),
  ) as Roster;
  return validRoster(roster) ? roster : null;
}

export function lineupLink(base: string, roster: Roster): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.search = `lineup=${POSITIONS.map((p) => roster[p] ?? 0).join(",")}`;
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
  return Object.fromEntries(POSITIONS.map((p, i) => [p, pool[i]])) as Roster;
}
