import { POKEMON_BY_ID } from "../data/pokemon";
import {
  draftComparisonMetrics,
  draftImpactFromProfiles,
  draftRosterProfile,
  type DraftImpactFocus,
  type DraftImpactProjection,
} from "./draftImpact";
import { playerProfile } from "./playerProfile";
import {
  emptyRoster,
  POSITIONS,
  ROSTER_SLOTS,
  type Roster,
  type RosterSlot,
  type RotationStyle,
  type Tactic,
} from "./types";

const round = (n: number) => Math.round(n * 10) / 10;
type Profile = ReturnType<typeof draftRosterProfile>;
const balance = (p: Profile) =>
  round((round(p.offense) + round(p.defense)) / 2);
const value = (p: Profile, focus: DraftImpactFocus) =>
  focus === "balance" ? balance(p) : round(p[focus]);
const key = (r: Roster) => ROSTER_SLOTS.map((s) => r[s] ?? 0).join(",");

/** Optimal assignment for a cheap seed only. Actual engine ratings choose the winner. */
function assignmentSeed(
  ids: number[],
  fixed: Roster,
  focus?: DraftImpactFocus,
): Roster {
  ids = ids.filter((id) => !Object.values(fixed).includes(id));
  const utilities = ids.map((id) => {
    const p = playerProfile(POKEMON_BY_ID.get(id)!);
    const a = p.attributes;
    const tool =
      focus === "spacing"
        ? a.threePoint
        : focus === "creation"
          ? a.playmaking
          : focus === "rimProtection"
            ? (a.block + a.interiorDefense) / 2
            : focus === "rebounding"
              ? a.rebounding
              : focus === "offense"
                ? (a.shooting + a.playmaking + a.finishing) / 3
                : focus === "defense"
                  ? (a.perimeterDefense + a.interiorDefense + a.rebounding) / 3
                  : (a.shooting +
                      a.playmaking +
                      a.finishing +
                      a.perimeterDefense +
                      a.interiorDefense +
                      a.rebounding) /
                    6;
    return ROSTER_SLOTS.map((_, s) => {
      const fit = p.positions[s < 5 ? POSITIONS[s] : p.bestPosition];
      return focus ? (s < 5 ? 34 : 23.33) * (0.75 * tool + 0.25 * fit) : fit;
    });
  });
  const memo = new Map<number, { score: number; slots: number[] }>();
  function solve(i: number, used: number): { score: number; slots: number[] } {
    if (i === ids.length) return { score: 0, slots: [] };
    const cached = memo.get(used);
    if (cached) return cached;
    let best = { score: -Infinity, slots: [] as number[] };
    for (let s = 0; s < 8; s++) {
      if (used & (1 << s)) continue;
      const next = solve(i + 1, used | (1 << s));
      const score = utilities[i][s] + next.score;
      if (score > best.score) best = { score, slots: [s, ...next.slots] };
    }
    memo.set(used, best);
    return best;
  }
  const roster = { ...fixed };
  const used = ROSTER_SLOTS.reduce(
    (mask, slot, i) => (fixed[slot] === null ? mask : mask | (1 << i)),
    0,
  );
  solve(0, used).slots.forEach((s, i) => {
    roster[ROSTER_SLOTS[s]] = ids[i];
  });
  return roster;
}

/** Deterministic multi-start search, not an exhaustive/global-optimum claim. */
function searchLineup(
  seeds: Roster[],
  original: Roster,
  tactic: Tactic,
  rotation: RotationStyle,
  focus: DraftImpactFocus,
  locked: ReadonlySet<RosterSlot>,
) {
  const cache = new Map<
    string,
    { roster: Roster; profile: Profile; moves: number; benches: number }
  >();
  function evaluate(roster: Roster) {
    const k = key(roster),
      cached = cache.get(k);
    if (cached) return cached;
    const result = {
      roster,
      profile: draftRosterProfile(roster, tactic, rotation),
      moves: ROSTER_SLOTS.filter(
        (s) => original[s] !== null && original[s] !== roster[s],
      ).length,
      benches: ROSTER_SLOTS.slice(5).filter((s) => roster[s] !== null).length,
    };
    cache.set(k, result);
    return result;
  }
  type Result = ReturnType<typeof evaluate>;
  const better = (a: Result, b: Result) =>
    value(a.profile, focus) > value(b.profile, focus) ||
    (value(a.profile, focus) === value(b.profile, focus) &&
      (balance(a.profile) > balance(b.profile) ||
        (balance(a.profile) === balance(b.profile) &&
          (a.moves < b.moves ||
            (a.moves === b.moves && a.benches < b.benches)))));
  const rankedSeeds = seeds
    .map(evaluate)
    .sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
  let best = rankedSeeds[0];
  // Explore the strongest seed and both independent assignment seeds. Each pass
  // tries every pair, including occupied/empty and starter/reserve exchanges.
  const starts = [best, ...seeds.slice(-2).map(evaluate)];
  for (const start of starts) {
    let current = start;
    for (let pass = 0; pass < 4; pass++) {
      let next = current;
      for (let i = 0; i < 7; i++)
        for (let j = i + 1; j < 8; j++) {
          const a = ROSTER_SLOTS[i],
            b = ROSTER_SLOTS[j];
          if (locked.has(a) || locked.has(b)) continue;
          if (current.roster[a] === current.roster[b]) continue;
          const swapped = evaluate({
            ...current.roster,
            [a]: current.roster[b],
            [b]: current.roster[a],
          });
          if (better(swapped, next)) next = swapped;
        }
      if (next === current) break;
      current = next;
    }
    if (better(current, best)) best = current;
  }
  return best;
}

/** One fair, optimized-before baseline shared by the full eligible pool. */
export function createLineupDraftProjector(
  roster: Roster,
  tactic: Tactic,
  rotation: RotationStyle,
  focus: DraftImpactFocus,
  lockedSlots: readonly RosterSlot[] = [],
): (pokemonId: number) => DraftImpactProjection | null {
  const locked = new Set(lockedSlots);
  const fixed = emptyRoster();
  for (const slot of locked) {
    if (!ROSTER_SLOTS.includes(slot) || roster[slot] === null)
      throw new Error("Only occupied roster positions can be locked.");
    fixed[slot] = roster[slot];
  }
  const owned = ROSTER_SLOTS.flatMap((s) =>
    roster[s] === null ? [] : [roster[s]!],
  );
  if (owned.length >= 8) return () => null;
  const before = searchLineup(
    [roster, assignmentSeed(owned, fixed), assignmentSeed(owned, fixed, focus)],
    roster,
    tactic,
    rotation,
    focus,
    locked,
  );
  return (pokemonId) => {
    if (owned.includes(pokemonId) || !POKEMON_BY_ID.has(pokemonId)) return null;
    const ids = [...owned, pokemonId];
    // Keep all unchanged/open-slot placements as seeds: rearranging can never
    // score worse than the existing best-open mode for the selected priority.
    const seeds = [roster, before.roster].flatMap((r) =>
      ROSTER_SLOTS.filter((s) => r[s] === null).map((s) => ({
        ...r,
        [s]: pokemonId,
      })),
    );
    seeds.push(assignmentSeed(ids, fixed), assignmentSeed(ids, fixed, focus));
    const after = searchLineup(seeds, roster, tactic, rotation, focus, locked);
    const impact = draftImpactFromProfiles(
      before.profile,
      after.profile,
      owned.length,
    );
    return {
      pokemonId,
      slot: ROSTER_SLOTS.find((s) => after.roster[s] === pokemonId)!,
      impact,
      metrics: draftComparisonMetrics(impact),
      lineup: { before: { ...before.roster }, after: { ...after.roster } },
    };
  };
}
