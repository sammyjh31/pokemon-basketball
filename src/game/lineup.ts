import { POKEMON_BY_ID } from "../data/pokemon";
import { draftPokemon, inDraftPool, type DraftPool } from "./draftPool";
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

/** Undefined means an old, untagged Gen I–II link; null means an invalid tag. */
export function parseLineupPool(search: string): DraftPool | undefined | null {
  const pool = new URLSearchParams(search).get("pool");
  if (pool === null) return undefined;
  if (pool === "all") return "all";
  return /^[1-7]$/.test(pool) ? (Number(pool) as DraftPool) : null;
}

export function parseLineup(search: string): Roster | null {
  const source = new URLSearchParams(search).get("lineup");
  if (!source || !/^\d{1,3}(,\d{1,3}){4}(,\d{1,3}){0,3}$/.test(source))
    return null;
  const ids = source.split(",").map(Number);
  const pool = parseLineupPool(search);
  if (pool === null) return null;
  const max = pool === undefined ? 251 : 809;
  if (
    (ids.length !== 5 && ids.length !== 8) ||
    ids.some((id) => id !== 0 && !inDraftPool(pool, id)) ||
    ids.every((id) => id === 0)
  )
    return null;
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((p, i) => [p, ids[i] || null]),
  ) as Roster;
  return validRoster(roster, true, max) ? roster : null;
}

export function lineupLink(
  base: string,
  roster: Roster,
  pool?: DraftPool,
): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.search = `lineup=${ROSTER_SLOTS.map((p) => roster[p] ?? 0).join(",")}`;
  if (pool !== undefined) url.searchParams.set("pool", String(pool));
  else if (Object.values(roster).some((id) => id !== null && id > 251))
    url.searchParams.set("pool", "all");
  return url.toString();
}

export function randomLineup(
  includeLegends: boolean,
  seed: number,
  selection?: DraftPool,
): Roster {
  const pool = draftPokemon(selection)
    .filter((mon) => includeLegends || !mon.legendary)
    .map((mon) => mon.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const random = nextRandom(seed);
    seed = random.seed;
    const j = Math.floor(random.value * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return Object.fromEntries(ROSTER_SLOTS.map((p, i) => [p, pool[i]])) as Roster;
}
