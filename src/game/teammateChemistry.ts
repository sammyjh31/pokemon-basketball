import { POKEMON_BY_ID } from "../data/pokemon";
import type { LeagueTeam, LeagueMatch } from "./types";

/** Effective shared court minutes, by species (never by roster slot). */
export type PairBonds = Record<string, number>;
export interface ChemistryFixture {
  home: number[];
  away: number[];
}
export type ChemistryBanks = Record<number, PairBonds>;
export const MAX_PAIR_MINUTES = 6000;
const MAX_PAIRS = 4096;
type ChemistryTeam = {
  roster: LeagueTeam["roster"];
  chemistryGrowthVersion?: 1;
  chemistryBonds?: PairBonds;
};
export const pairKey = (a: number, b: number) =>
  a < b ? `${a}:${b}` : `${b}:${a}`;
export const pairBond = (minutes: number) =>
  Math.max(0, minutes) / (Math.max(0, minutes) + 600);
const round = (minutes: number) => Math.round(minutes * 100) / 100;
const rosterPairs = (team: ChemistryTeam) => {
  const ids = Object.values(team.roster)
    .filter((id): id is number => id != null)
    .sort((a, b) => a - b);
  if (ids.length !== 8 || new Set(ids).size !== 8)
    throw new Error("Teammate history requires eight distinct roster players.");
  return ids.flatMap((a, i) => ids.slice(i + 1).map((b) => pairKey(a, b)));
};
/** Mutable accumulator for one clock segment. Round only at the game boundary. */
export function addSharedMinutes(
  target: PairBonds,
  ids: readonly number[],
  minutes: number,
): void {
  if (
    ids.length !== 5 ||
    new Set(ids).size !== 5 ||
    !Number.isFinite(minutes) ||
    minutes < 0
  )
    throw new Error("Invalid shared court time.");
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const key = pairKey(ids[i], ids[j]);
      target[key] = (target[key] ?? 0) + minutes;
    }
}
export function finishPairMinutes(values: PairBonds): PairBonds {
  return Object.fromEntries(
    Object.keys(values)
      .sort()
      .filter((key) => round(values[key]) > 0)
      .map((key) => [key, round(values[key])]),
  );
}
export function validatePairBonds(raw: unknown): PairBonds {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw new Error("Invalid teammate history.");
  const pairs = Object.entries(raw);
  if (pairs.length > MAX_PAIRS)
    throw new Error("Teammate history is too large.");
  for (const [key, value] of pairs) {
    const ids = key.split(":").map(Number);
    if (
      ids.length !== 2 ||
      ids[0] >= ids[1] ||
      !ids.every((id) => Number.isInteger(id) && POKEMON_BY_ID.has(id)) ||
      key !== pairKey(ids[0], ids[1]) ||
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > MAX_PAIR_MINUTES ||
      Math.abs(value - round(value)) > 1e-7
    )
      throw new Error("Invalid teammate history pair.");
  }
  return Object.fromEntries(
    pairs.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}
export function snapshotChemistry(
  home: ChemistryTeam,
  away: ChemistryTeam,
): ChemistryFixture | undefined {
  if (home.chemistryGrowthVersion !== away.chemistryGrowthVersion)
    throw new Error("Mixed teammate growth rules.");
  if (home.chemistryGrowthVersion !== 1) return undefined;
  return {
    home: rosterPairs(home).map((k) => home.chemistryBonds?.[k] ?? 0),
    away: rosterPairs(away).map((k) => away.chemistryBonds?.[k] ?? 0),
  };
}
export function applyChemistrySnapshot<T extends ChemistryTeam>(
  team: T,
  values: number[],
): T {
  const keys = rosterPairs(team);
  if (
    team.chemistryGrowthVersion !== 1 ||
    !Array.isArray(values) ||
    values.length !== 28 ||
    values.some(
      (v) =>
        !Number.isFinite(v) ||
        v < 0 ||
        v > MAX_PAIR_MINUTES ||
        Math.abs(v - round(v)) > 1e-7,
    )
  )
    throw new Error("Invalid pregame teammate history.");
  const bonds = { ...team.chemistryBonds };
  keys.forEach((key, i) => {
    if (values[i] > 0) bonds[key] = values[i];
    else delete bonds[key];
  });
  return { ...team, chemistryBonds: bonds };
}
export function initialChemistryBanks(
  teams: readonly LeagueTeam[],
): ChemistryBanks | undefined {
  const enabled = teams[0]?.chemistryGrowthVersion === 1;
  if (teams.some((t) => (t.chemistryGrowthVersion === 1) !== enabled))
    throw new Error("Mixed teammate growth rules.");
  return enabled
    ? Object.fromEntries(teams.map((t) => [t.id, { ...t.chemistryBonds }]))
    : undefined;
}
export function teamsWithChemistry(
  teams: LeagueTeam[],
  banks: ChemistryBanks | undefined,
): LeagueTeam[] {
  if (!banks) return teams;
  return teams.map((t) =>
    t.chemistryGrowthVersion === 1
      ? { ...t, chemistryBonds: { ...(banks[t.id] ?? t.chemistryBonds) } }
      : t,
  );
}
/** Called exactly once per completed fixture by the sequential season/playoff builder. */
export function recordChemistryGame(
  banks: ChemistryBanks | undefined,
  home: LeagueTeam,
  away: LeagueTeam,
  match: Pick<LeagueMatch, "chemistryMinutes">,
): void {
  if (!banks) return;
  if (!match.chemistryMinutes) throw new Error("Missing shared court minutes.");
  for (const [team, side] of [
    [home, "home"],
    [away, "away"],
  ] as const) {
    const allowed = new Set(rosterPairs(team));
    const bank = banks[team.id] ?? {};
    for (const [key, minutes] of Object.entries(match.chemistryMinutes[side])) {
      if (!allowed.has(key) || !Number.isFinite(minutes) || minutes < 0)
        throw new Error("Invalid shared court minutes.");
      bank[key] = Math.min(MAX_PAIR_MINUTES, round((bank[key] ?? 0) + minutes));
    }
    banks[team.id] = finishPairMinutes(bank);
  }
}
/** Read only the incoming roster's 28 pairs, rather than copying an entire league bank. */
export function withKnownBonds<T extends ChemistryTeam>(
  team: T,
  sources: readonly ChemistryTeam[],
): T {
  if (team.chemistryGrowthVersion !== 1) return team;
  let bonds: PairBonds | undefined;
  for (const key of rosterPairs(team)) {
    const prior = team.chemistryBonds?.[key] ?? 0;
    let value = prior;
    for (const source of sources)
      if (source.chemistryGrowthVersion === 1)
        value = Math.max(value, source.chemistryBonds?.[key] ?? 0);
    if (value > prior) {
      bonds ??= { ...team.chemistryBonds };
      bonds[key] = value;
    }
  }
  return bonds ? { ...team, chemistryBonds: finishPairMinutes(bonds) } : team;
}
/** Import remembered connections of incoming pairs; keep former pairs for reunions. */
export function syncTeamBonds<T extends ChemistryTeam>(teams: T[]): T[] {
  if (!teams.some((t) => t.chemistryGrowthVersion === 1)) return teams;
  const remembered: PairBonds = {};
  for (const t of teams)
    if (t.chemistryGrowthVersion === 1)
      for (const [key, value] of Object.entries(t.chemistryBonds ?? {}))
        remembered[key] = Math.max(remembered[key] ?? 0, value);
  return teams.map((t) => {
    if (t.chemistryGrowthVersion !== 1) return t;
    const bonds = { ...t.chemistryBonds };
    for (const key of rosterPairs(t))
      if (remembered[key] > 0) bonds[key] = remembered[key];
    return { ...t, chemistryBonds: finishPairMinutes(bonds) };
  });
}
/** Exactly one seasonal boundary softens old timing; it never earns new minutes. */
export function retainChemistry<T extends ChemistryTeam>(
  team: T,
): T & { chemistryGrowthVersion: 1; chemistryBonds: PairBonds } {
  // Banks already store hundredths. Integer arithmetic preserves exact
  // half-cent rounding (for example, 16.15 retains 14.54, not 14.53).
  return {
    ...team,
    chemistryGrowthVersion: 1,
    chemistryBonds: finishPairMinutes(
      Object.fromEntries(
        Object.entries(
          team.chemistryGrowthVersion === 1 ? (team.chemistryBonds ?? {}) : {},
        ).map(([k, v]) => [
          k,
          Math.round((Math.round(v * 100) * 9) / 10) / 100,
        ]),
      ),
    ),
  };
}
