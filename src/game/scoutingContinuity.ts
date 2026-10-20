import {
  updateCounterResults,
  strongestCounterResults,
} from "./counterLearning";
import { POKEMON_BY_ID } from "../data/pokemon";
import { getCoach } from "./trainerCoaches";
import {
  emptyScouting,
  validateOpponentScouting,
  validateMatchScouting,
} from "./opponentScouting";
import { MOVE_IDS } from "./moveTypes";
import { COMBO_IDS } from "./comboTypes";
import { signatureMoves } from "./signatureMoves";
import { ROSTER_SLOTS, type LeagueTeam } from "./types";
import type {
  OpponentScouting,
  ScoutingMemory,
  ScoutedPlayer,
} from "./typeTacticsTypes";
import type {
  CoachBook,
  CoachScoutingSeed,
  ScoutingHistory,
  ScoutingTeam,
  SeedOpponent,
} from "./scoutingContinuityTypes";
const AGE = 0.72,
  HANDOVER = 0.35,
  LOOKBACK = 8;
const members = (ids: readonly number[]) => [...ids].sort((a, b) => a - b);
const round = (n: number) => Math.round(n * 1000) / 1000;
const fail = (): never => {
  throw Error("Invalid carried coach scouting.");
};
function obj(raw: unknown, keys?: string[]): Record<string, unknown> {
  if (
    !raw ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    ![null, Object.prototype].includes(Object.getPrototypeOf(raw))
  )
    return fail();
  const names = Reflect.ownKeys(raw);
  if (
    names.some((k) => typeof k !== "string") ||
    (keys &&
      (names.length !== keys.length ||
        keys.some((k) => !Object.hasOwn(raw, k))))
  )
    return fail();
  return raw as Record<string, unknown>;
}
function integer(n: unknown, min: number, max: number): number {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < min || n > max)
    return fail();
  return n;
}
const trainer = (id: unknown): string =>
  typeof id === "string" && getCoach(id) ? id : fail();
function roster(raw: unknown): number[] {
  if (
    !Array.isArray(raw) ||
    raw.length !== 8 ||
    new Set(raw).size !== 8 ||
    raw.some(
      (id) =>
        !Number.isInteger(id) || id < 1 || id > 1025 || !POKEMON_BY_ID.has(id),
    )
  )
    return fail();
  return [...raw];
}
const asRoster = (ids: number[]) =>
  Object.fromEntries(
    ROSTER_SLOTS.map((slot, i) => [slot, ids[i]]),
  ) as LeagueTeam["roster"];
/** Rounded summaries are explicit future-season inputs, never changes to old results. */
export function compactScouting(
  data: OpponentScouting,
  factor = 1,
): OpponentScouting {
  const players: Record<number, ScoutedPlayer> = {};
  for (const [id, p] of Object.entries(data.players)) {
    const value = {
      attempts: round(p.attempts * factor),
      points: round(p.points * factor),
      rimAttempts: round(p.rimAttempts * factor),
      threeAttempts: round(p.threeAttempts * factor),
    };
    if (value.attempts > 0) {
      value.points = Math.min(value.points, 3 * value.attempts);
      value.rimAttempts = Math.min(value.rimAttempts, value.attempts);
      value.threeAttempts = Math.min(
        value.threeAttempts,
        round(value.attempts - value.rimAttempts),
      );
      players[Number(id)] = value;
    }
  }
  const result: OpponentScouting = {
    ...emptyScouting(),
    ...(data.counterResults
      ? {
          counterResults: updateCounterResults(
            data.counterResults,
            undefined,
            factor,
          ),
        }
      : {}),
    games: Math.min(500, data.games),
    possessions: round(data.possessions * factor),
    pickRolls: round(data.pickRolls * factor),
    switches: round(data.switches * factor),
    helpRotations: round(data.helpRotations * factor),
    players,
    ...(data.carried === 1 ? { carried: 1 as const } : {}),
  };
  if (data.moveReads) {
    const moves: NonNullable<OpponentScouting["moveReads"]>["moves"] = {},
      combos: NonNullable<OpponentScouting["moveReads"]>["combos"] = {};
    for (const id of MOVE_IDS) {
      const n = round((data.moveReads.moves[id] ?? 0) * factor);
      if (n >= 0.05) moves[id] = n;
    }
    for (const id of COMBO_IDS) {
      const n = round((data.moveReads.combos[id] ?? 0) * factor);
      if (n >= 0.05) combos[id] = n;
    }
    result.moveReads = { moves, combos };
  }
  return result;
}
export function parseCoachBook(
  raw: unknown,
  year: number,
  rosters: readonly (readonly number[])[],
): CoachBook {
  const value = obj(raw, ["version", "year", "teams", "coaches"]);
  if (
    value.version !== 1 ||
    value.year !== year ||
    !Array.isArray(value.teams) ||
    value.teams.length !== rosters.length ||
    rosters.length < 4 ||
    rosters.length > 30
  )
    return fail();
  const used = new Set<string>();
  const teams: ScoutingTeam[] = value.teams.map((raw, i) => {
    const t = obj(raw),
      ids = roster(t.roster);
    if (
      Object.keys(t).length !== (t.coachId === undefined ? 2 : 3) ||
      t.id !== i ||
      JSON.stringify(ids) !== JSON.stringify(rosters[i])
    )
      return fail();
    const coachId = t.coachId === undefined ? undefined : trainer(t.coachId);
    if (coachId && used.has(coachId)) return fail();
    if (coachId) used.add(coachId);
    return { id: i, roster: ids, ...(coachId ? { coachId } : {}) };
  });
  const coaches: CoachBook["coaches"] = {};
  for (const [id, raw] of Object.entries(obj(value.coaches))) {
    trainer(id);
    const source = obj(raw),
      teamId = integer(source.teamId, 0, teams.length - 1);
    obj(raw, [
      "teamId",
      "opponents",
      ...(source.selfPlayers === undefined ? [] : ["selfPlayers"]),
    ]);
    if (teams[teamId].coachId !== id) return fail();
    const opponents: Record<number, OpponentScouting> = {};
    for (const [key, data] of Object.entries(obj(source.opponents))) {
      const target = integer(Number(key), 0, teams.length - 1);
      if (String(target) !== key || target === teamId) return fail();
      const scouting = validateOpponentScouting(data, {
        movesetVersion: 4,
        roster: asRoster(teams[target].roster),
      });
      if (!scouting.games) return fail();
      opponents[target] = scouting;
    }
    const selfPlayers =
      source.selfPlayers === undefined
        ? undefined
        : validateOpponentScouting(
            { ...emptyScouting(), games: 1, players: source.selfPlayers },
            { movesetVersion: 4, roster: asRoster(teams[teamId].roster) },
          ).players;
    coaches[id] = {
      teamId,
      ...(selfPlayers ? { selfPlayers } : {}),
      opponents,
    };
  }
  return { version: 1, year, teams, coaches };
}
export function parseScoutingSeed(
  raw: unknown,
  ownId: number,
  teamCount: number,
): CoachScoutingSeed {
  const v = obj(raw, ["version", "year", "coachId", "opponents"]);
  if (v.version !== 1) return fail();
  const year = integer(v.year, 2, 1000),
    coachId = trainer(v.coachId),
    opponents: Record<number, SeedOpponent> = {};
  for (const [key, raw] of Object.entries(obj(v.opponents))) {
    const id = integer(Number(key), 0, teamCount - 1);
    if (String(id) !== key || id === ownId) return fail();
    const p = obj(raw),
      ids = roster(p.roster);
    const required = [
      "roster",
      "opponentName",
      "scouting",
      "sourceCoachId",
      "sourceYear",
      "retainedPlayers",
      "coachChanged",
      ...(p.opponentCoachId === undefined ? [] : ["opponentCoachId"]),
    ];
    obj(raw, required);
    if (
      typeof p.coachChanged !== "boolean" ||
      typeof p.opponentName !== "string" ||
      !p.opponentName.trim() ||
      p.opponentName.length > 120
    )
      return fail();
    const scouting = validateOpponentScouting(p.scouting, {
      movesetVersion: 4,
      roster: asRoster(ids),
    });
    if (scouting.carried !== 1) return fail();
    opponents[id] = {
      roster: ids,
      opponentName: p.opponentName,
      ...(p.opponentCoachId !== undefined
        ? { opponentCoachId: trainer(p.opponentCoachId) }
        : {}),
      scouting,
      sourceCoachId: trainer(p.sourceCoachId),
      sourceYear: integer(p.sourceYear, Math.max(1, year - LOOKBACK), year - 1),
      retainedPlayers: integer(p.retainedPlayers, 0, 8),
      coachChanged: p.coachChanged,
    };
  }
  return { version: 1, year, coachId, opponents };
}
type Source = {
  book: CoachBook;
  coachId: string;
  entry: CoachBook["coaches"][string];
  weight: number;
};
/** Only compact annual books are scanned; no historical game is replayed here. */
export function seedCoachScouting<T extends LeagueTeam>(
  history: readonly ScoutingHistory[],
  teams: T[],
  year: number,
): T[] {
  const books = history
    .filter((h) => h.year < year && h.year >= year - LOOKBACK && h.coachBook)
    .map((h) => h.coachBook!)
    .sort((a, b) => b.year - a.year);
  if (!history.some((h) => h.year < year && h.coachBook))
    return teams.map((t) => {
      const { scoutingSeed: _, ...rest } = t;
      return rest as T;
    });
  return teams.map((team) => {
    if (
      !team.coach ||
      (team.movesetVersion ?? 0) < 3 ||
      team.typeTacticsVersion !== 1
    )
      return team;
    const sources: Source[] = [];
    for (const book of books) {
      const personal = book.coaches[team.coach.id];
      if (personal)
        sources.push({
          book,
          coachId: team.coach.id,
          entry: personal,
          weight: 1,
        });
      const club = Object.entries(book.coaches).find(
        ([id, entry]) => entry.teamId === team.id && id !== team.coach!.id,
      );
      if (club)
        sources.push({
          book,
          coachId: club[0],
          entry: club[1],
          weight: HANDOVER,
        });
    }
    // Index each coach's observed facts once, rather than rescan every old
    // opponent for every current player during every archived-year validation.
    const knownPlayers = new Map<
      number,
      { data: ScoutedPlayer; weight: number; source: Source }
    >();
    const knownSignatures = new Map<
      number,
      {
        moves: NonNullable<OpponentScouting["moveReads"]>["moves"];
        source: Source;
      }
    >();
    for (const source of sources) {
      const weight = AGE ** (year - source.book.year) * source.weight;
      for (const data of [
        ...Object.values(source.entry.opponents),
        { players: source.entry.selfPlayers ?? {} },
      ])
        for (const [key, known] of Object.entries(data.players)) {
          const id = Number(key),
            best = knownPlayers.get(id);
          if (
            !best ||
            known.attempts * weight > best.data.attempts * best.weight
          )
            knownPlayers.set(id, { data: known, weight, source });
        }
      for (const [target, data] of Object.entries(source.entry.opponents)) {
        const old = source.book.teams[Number(target)];
        if (!old) continue;
        for (const move of signatureMoves) {
          if (move.signature?.kind !== "species") continue;
          const count = round(
            (data.moveReads?.moves[move.id] ?? 0) * weight * 0.7,
          );
          if (count < 0.05) continue;
          const eligible = old.roster.filter((id) =>
            move.signature!.speciesIds!.includes(id),
          );
          if (eligible.length !== 1) continue;
          const id = eligible[0],
            known = knownSignatures.get(id) ?? { moves: {}, source };
          known.moves[move.id] = Math.max(known.moves[move.id] ?? 0, count);
          knownSignatures.set(id, known);
        }
      }
    }
    const opponents: Record<number, SeedOpponent> = {};
    for (const opponent of teams) {
      if (opponent.id === team.id) continue;
      const ids = members(Object.values(opponent.roster) as number[]);
      const candidates = sources
        .flatMap((source) => {
          const data = source.entry.opponents[opponent.id],
            old = source.book.teams[opponent.id];
          if (!data || !old) return [];
          const retained = ids.filter((id) => old.roster.includes(id)).length,
            changed = old.coachId !== opponent.coach?.id;
          const age = AGE ** (year - source.book.year) * source.weight,
            factor = ((age * retained) / 8) * (changed ? 0.45 : 1);
          return [{ source, data, old, retained, changed, age, factor }];
        })
        .sort(
          (a, b) =>
            b.data.possessions * b.factor - a.data.possessions * a.factor,
        );
      const chosen = candidates[0],
        players: Record<number, ScoutedPlayer> = {};
      let fallback: Source | undefined;
      const signatureReads: NonNullable<
        OpponentScouting["moveReads"]
      >["moves"] = {};
      for (const id of ids) {
        const best = knownPlayers.get(id);
        if (best) {
          const compact = compactScouting(
            { ...emptyScouting(), players: { [id]: best.data } },
            best.weight,
          ).players[id];
          if (compact) {
            players[id] = compact;
            fallback ??= best.source;
          }
        }
        const signature = knownSignatures.get(id);
        if (signature) {
          for (const [move, n] of Object.entries(signature.moves)) {
            const key = move as (typeof MOVE_IDS)[number];
            signatureReads[key] = Math.max(signatureReads[key] ?? 0, n!);
          }
          fallback ??= signature.source;
        }
      }
      if (
        !chosen &&
        !Object.keys(players).length &&
        !Object.keys(signatureReads).length
      )
        continue;
      const scouting = chosen
        ? compactScouting(chosen.data, chosen.factor)
        : emptyScouting();
      if (team.movesetVersion === 4) {
        const results = strongestCounterResults(
          candidates.map((c) => ({
            results: c.data.counterResults,
            factor: c.factor,
          })),
        );
        if (results) scouting.counterResults = results;
        else delete scouting.counterResults;
      } else delete scouting.counterResults;
      scouting.carried = 1;
      scouting.players = players;
      if (chosen?.data.moveReads) {
        const pair = (chosen.retained * (chosen.retained - 1)) / 56;
        for (const id of COMBO_IDS) {
          const n = round(
            (chosen.data.moveReads.combos[id] ?? 0) *
              chosen.age *
              pair *
              (chosen.changed ? 0.45 : 1),
          );
          if (n >= 0.05) scouting.moveReads!.combos[id] = n;
          else delete scouting.moveReads!.combos[id];
        }
      }
      if (Object.keys(signatureReads).length) {
        scouting.moveReads ??= { moves: {}, combos: {} };
        for (const [id, n] of Object.entries(signatureReads)) {
          const key = id as (typeof MOVE_IDS)[number];
          scouting.moveReads.moves[key] = Math.max(
            scouting.moveReads.moves[key] ?? 0,
            n!,
          );
        }
      }
      const source = chosen?.source ?? fallback!;
      opponents[opponent.id] = {
        roster: ids,
        opponentName: opponent.name,
        ...(opponent.coach ? { opponentCoachId: opponent.coach.id } : {}),
        scouting,
        sourceCoachId: source.coachId,
        sourceYear: source.book.year,
        retainedPlayers: chosen?.retained ?? 0,
        coachChanged: chosen?.changed ?? false,
      };
    }
    return {
      ...team,
      scoutingSeed: {
        version: 1 as const,
        year,
        coachId: team.coach.id,
        opponents,
      },
    };
  });
}
/** Inputs belong to this season's roster/appointments; current offseason copies are only structurally parsed. */
export function initialSeasonScouting(teams: LeagueTeam[]): ScoutingMemory {
  const memory: ScoutingMemory = {};
  for (const team of teams)
    if (team.scoutingSeed) {
      const seed = parseScoutingSeed(team.scoutingSeed, team.id, teams.length);
      if (
        seed.coachId !== team.coach?.id ||
        (team.movesetVersion ?? 0) < 3 ||
        team.typeTacticsVersion !== 1
      )
        return fail();
      for (const [key, entry] of Object.entries(seed.opponents)) {
        const opponent = teams.find((t) => t.id === Number(key));
        if (
          !opponent ||
          JSON.stringify(members(entry.roster)) !==
            JSON.stringify(
              members(Object.values(opponent.roster) as number[]),
            ) ||
          entry.opponentCoachId !== opponent.coach?.id
        )
          return fail();
        memory[`${team.id}:${key}`] = structuredClone(entry.scouting);
      }
    }
  return memory;
}
export function validateScoutingSeeds(
  history: readonly ScoutingHistory[],
  teams: LeagueTeam[],
  year: number,
) {
  const expected = seedCoachScouting(history, teams, year);
  for (let i = 0; i < teams.length; i++)
    if (!sameScoutingData(teams[i].scoutingSeed, expected[i].scoutingSeed))
      return fail();
  initialSeasonScouting(teams);
}
/** Compare versioned facts independently of parser property order. */
export function sameScoutingData(a: unknown, b: unknown): boolean {
  const normalize = (v: any): any =>
    Array.isArray(v)
      ? v.map(normalize)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, normalize(v[k])]),
          )
        : v;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
export function openingScouting(home: LeagueTeam, away: LeagueTeam) {
  const entry = (team: LeagueTeam, opponent: LeagueTeam) => {
    if (!team.scoutingSeed) return emptyScouting();
    const seed = parseScoutingSeed(team.scoutingSeed, team.id, 30),
      old = seed.opponents[opponent.id];
    if (
      seed.coachId !== team.coach?.id ||
      (team.movesetVersion ?? 0) < 3 ||
      team.typeTacticsVersion !== 1
    )
      return fail();
    if (
      old &&
      (JSON.stringify(members(old.roster)) !==
        JSON.stringify(members(Object.values(opponent.roster) as number[])) ||
        old.opponentCoachId !== opponent.coach?.id)
    )
      return fail();
    return structuredClone(old?.scouting ?? emptyScouting());
  };
  return { home: entry(home, away), away: entry(away, home) };
}
