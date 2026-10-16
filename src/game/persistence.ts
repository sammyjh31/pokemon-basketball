import { POKEMON_BY_ID } from "../data/pokemon";
import { initialState } from "./state";
import { simulateSeason, simulateSeasonAsync } from "./season";
import { replayPlayoffs } from "./playoffs";
import { validateFranchise, validateLeagueTeams } from "./franchiseValidation";
import {
  ROSTER_SLOTS,
  TACTICS,
  ROTATIONS,
  DEFENSE_SCHEMES,
  type GameState,
  type ModeRecords,
  type Roster,
  type Run,
  type SeasonResult,
} from "./types";
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export const STORAGE_KEY = "pokemon-basketball:v3";
import { validateV2 } from "./v2Persistence";
const fail = (): never => {
  throw new Error("Invalid saved game");
};
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail();
  return value as Record<string, unknown>;
}
function integer(
  value: unknown,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    return fail();
  return value;
}
function records(value: unknown): ModeRecords {
  const row = object(value),
    runs = integer(row.runs),
    bestWins = integer(row.bestWins, 0, 82),
    perfectSeasons = integer(row.perfectSeasons, 0, runs);
  if (
    (runs === 0 && bestWins !== 0) ||
    (perfectSeasons > 0 && bestWins !== 82) ||
    (bestWins === 82 && perfectSeasons === 0)
  )
    return fail();
  return { runs, bestWins, perfectSeasons };
}
function validate(value: unknown, replay?: SeasonResult): GameState {
  const root = object(value);
  if (root.version === 1 || root.version === 2) return validateV2(root);
  if (root.version !== 3) return fail();
  const candidate = object(root.run);
  if (
    candidate.result &&
    [1, 2].includes(object(candidate.result).modelVersion as number)
  ) {
    return validateV2({ ...root, version: 2 });
  }
  const raw = object(root.run),
    source = object(raw.roster),
    history = object(root.records);
  if (raw.mode !== "spin" && raw.mode !== "free") return fail();
  if (
    typeof raw.includeLegends !== "boolean" ||
    typeof raw.id !== "string" ||
    !/^run-\d{1,10}$/.test(raw.id)
  )
    return fail();
  const roster = {} as Roster;
  if (Object.keys(source).length !== 8) return fail();
  for (const position of ROSTER_SLOTS) {
    const id = source[position];
    if (id === null) {
      roster[position] = null;
      continue;
    }
    const mon = POKEMON_BY_ID.get(integer(id, 1, 251));
    if (!mon || (!raw.includeLegends && mon.legendary)) return fail();
    roster[position] = mon.id;
  }
  const chosen = Object.values(roster).filter((id) => id !== null);
  if (new Set(chosen).size !== chosen.length || !Array.isArray(raw.offerIds))
    return fail();
  const offerIds = raw.offerIds.map((id) => integer(id, 1, 251));
  const expectedOffers = raw.mode === "spin" && chosen.length < 8 ? 4 : 0;
  if (
    offerIds.length !== expectedOffers ||
    new Set(offerIds).size !== offerIds.length ||
    offerIds.some(
      (id) =>
        chosen.includes(id) ||
        (!raw.includeLegends && POKEMON_BY_ID.get(id)!.legendary),
    )
  )
    return fail();
  const run: Run = {
    id: raw.id,
    mode: raw.mode,
    includeLegends: raw.includeLegends,
    roster,
    offerIds,
    rerollsLeft: integer(raw.rerollsLeft, 0, 2),
    draftSeed: integer(raw.draftSeed, 0, 0xffffffff),
    seasonSeed: integer(raw.seasonSeed, 0, 0xffffffff),
    tactic: TACTICS.includes(raw.tactic as never)
      ? (raw.tactic as Run["tactic"])
      : fail(),
    rotation: ROTATIONS.includes(raw.rotation as never)
      ? (raw.rotation as Run["rotation"])
      : fail(),
    defense:
      raw.defense === undefined
        ? "man"
        : DEFENSE_SCHEMES.includes(raw.defense as never)
          ? (raw.defense as Run["defense"])
          : fail(),
    result: null,
  };
  const parsedRecords = {
    spin: records(history.spin),
    free: records(history.free),
  };
  if (Object.hasOwn(raw, "leagueTeams")) {
    if (!Object.hasOwn(root, "franchise") || chosen.length !== 8) return fail();
    run.leagueTeams = validateLeagueTeams(raw.leagueTeams, run.includeLegends);
  }
  if (raw.result !== null) {
    const result = object(raw.result);
    if (
      chosen.length !== 8 ||
      ([4, 5].includes(result.modelVersion as number) && !run.leagueTeams) ||
      !Array.isArray(result.games) ||
      result.games.length !== 82
    )
      return fail();
    // Replay the shared league to validate every result, standing, player total and award.
    const expected = replay ?? simulateSeason(run);
    if (
      result.wins !== expected.wins ||
      result.losses !== expected.losses ||
      result.mvpId !== expected.mvpId
    )
      return fail();
    if (JSON.stringify(result) !== JSON.stringify(expected)) return fail();
    const record = parsedRecords[run.mode];
    if (
      !run.leagueTeams &&
      (record.runs < 1 ||
        record.bestWins < expected.wins ||
        (expected.wins === 82 && record.perfectSeasons < 1))
    )
      return fail();
    run.result = expected;
  }
  return { version: 3, run, records: parsedRecords };
}
export interface LoadedGame {
  state: GameState;
  notice: string | null;
  preserveSource?: boolean;
}
export interface PreparedGameLoad extends LoadedGame {
  restore?: (
    onProgress: (completed: number, total: number) => void,
    signal: AbortSignal,
  ) => Promise<LoadedGame>;
}
function validateSavedGame(value: unknown, replay?: SeasonResult): LoadedGame {
  // Only a verified regular season can supply teams or seeds for the playoffs.
  const state = validate(value, replay);
  const root = object(value),
    raw = object(root.run);
  let loaded: LoadedGame = { state, notice: null };
  if (Object.hasOwn(raw, "playoffs"))
    try {
      const candidate = object(raw.playoffs);
      if (
        !state.run.result ||
        ![3, 4, 5].includes(state.run.result?.modelVersion as number) ||
        !state.run.result.league ||
        candidate.modelVersion !== 1 ||
        !Array.isArray(candidate.series) ||
        candidate.series.length !== 15
      )
        return fail();
      // Bound replay work before examining user-controlled nested game data.
      const gameCount = candidate.series.reduce((count, value) => {
        const series = object(value);
        if (!Array.isArray(series.games) || series.games.length > 7)
          return fail();
        return count + series.games.length;
      }, 0);
      integer(gameCount, 0, 105);
      const expected = replayPlayoffs(
        state.run.result.league,
        state.run.seasonSeed,
        gameCount,
      );
      if (JSON.stringify(candidate) !== JSON.stringify(expected)) return fail();
      state.run.playoffs = expected;
    } catch {
      loaded = {
        state,
        notice:
          "Your saved playoffs could not be restored. Your regular season is safe. The original save is kept until you advance the playoffs or start a new run.",
        preserveSource: true,
      };
    }
  if (Object.hasOwn(root, "franchise")) {
    try {
      state.franchise = validateFranchise(root.franchise, state.run);
    } catch {
      // A fixed-roster season cannot become a standalone challenge save: doing
      // so would silently discard the only copy of its previous years.
      if (
        state.run.leagueTeams ||
        [4, 5].includes(state.run.result?.modelVersion as number)
      )
        return fail();
      loaded = {
        state,
        notice:
          "Your saved franchise history could not be restored. Your verified season is safe. The original franchise save is kept until you make a change.",
        preserveSource: true,
      };
    }
  }
  return loaded;
}

function failedLoad(
  fallbackSeed: number,
  franchise: boolean,
  preserveSource: boolean,
): LoadedGame {
  return {
    state: initialState(fallbackSeed),
    notice: franchise
      ? "Your saved franchise could not be restored. A fresh draft is ready. The original franchise save is kept until you make a change."
      : preserveSource
        ? "Your saved game could not be restored. A fresh draft is ready. The original save is kept until you make a change."
        : "Your saved game could not be restored. A fresh draft is ready.",
    ...(franchise || preserveSource ? { preserveSource: true } : {}),
  };
}
function readGame(
  storage: StorageLike,
  fallbackSeed: number,
  deferLeague: boolean,
): PreparedGameLoad {
  let source: string | null;
  try {
    source =
      storage.getItem(STORAGE_KEY) ??
      storage.getItem("pokemon-basketball:v2") ??
      storage.getItem("pokemon-basketball:v1");
  } catch {
    return {
      state: initialState(fallbackSeed),
      notice:
        "Browser storage is unavailable. You can play, but progress will not be saved.",
    };
  }
  if (source === null)
    return { state: initialState(fallbackSeed), notice: null };
  let franchiseSave = false;
  try {
    const parsed: unknown = JSON.parse(source);
    const root = object(parsed),
      raw = object(root.run);
    franchiseSave =
      Object.hasOwn(root, "franchise") ||
      Object.hasOwn(raw, "leagueTeams") ||
      (!!raw.result &&
        [4, 5].includes(object(raw.result).modelVersion as number));
    if (
      deferLeague &&
      root.version === 3 &&
      raw.result !== null &&
      ![1, 2].includes(object(raw.result).modelVersion as number)
    ) {
      // Validate the inexpensive draft/history first; the app can paint before
      // the full league replay. Retain the original object for the final check.
      const state = validate({ ...root, run: { ...raw, result: null } });
      if (Object.hasOwn(root, "franchise")) {
        try {
          state.franchise = validateFranchise(root.franchise, state.run, true);
        } catch {
          // An original model-3 season can still be recovered asynchronously.
          // Fixed-roster seasons require a valid capsule before replay begins.
          if (state.run.leagueTeams)
            return failedLoad(fallbackSeed, true, true);
        }
      }
      return {
        state,
        notice: null,
        restore: async (onProgress, signal) => {
          try {
            const replay = await simulateSeasonAsync(
              state.run,
              onProgress,
              signal,
            );
            signal.throwIfAborted();
            return validateSavedGame(parsed, replay);
          } catch (error) {
            if (signal.aborted) throw error;
            return failedLoad(fallbackSeed, franchiseSave, true);
          }
        },
      };
    }
    return validateSavedGame(parsed);
  } catch {
    return failedLoad(fallbackSeed, franchiseSave, true);
  }
}
/** Synchronous loader retained for non-UI callers and archived model validation. */
export function loadGame(
  storage: StorageLike,
  fallbackSeed: number,
): LoadedGame {
  return readGame(storage, fallbackSeed, false);
}
/** Completed v3 leagues are validated in cancellable round batches after paint. */
export function prepareGameLoad(
  storage: StorageLike,
  fallbackSeed: number,
): PreparedGameLoad {
  return readGame(storage, fallbackSeed, true);
}
export function saveGame(
  storage: StorageLike,
  state: GameState,
): { saved: boolean; notice: string | null } {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { saved: true, notice: null };
  } catch {
    return {
      saved: false,
      notice:
        "Browser storage is unavailable. You can play, but progress will not be saved.",
    };
  }
}
