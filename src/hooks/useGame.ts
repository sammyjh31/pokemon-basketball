import { useEffect, useReducer, useState, useRef } from "react";
import { gameReducer, type GameAction } from "../game/state";
import {
  prepareGameLoad,
  saveGame,
  savedGameSource,
  STORAGE_KEY,
  type LoadedGame,
  type StorageLike,
} from "../game/persistence";
import {
  browserStorage,
  isSaveStorage,
  keepVerifiedCopy,
  setAsideRejected,
} from "../game/saveStorage";
import { restoreSavedGame, validateGameSource } from "../game/restoreClient";
import type { SaveControls } from "../components/SaveMenu";
import { useOtherTabChanges } from "./useOtherTabChanges";
import { simulateSeasonAsync } from "../game/season";
import { advanceFranchiseSeasonAsync } from "../game/interactiveSeason";
import type { OfficialGame } from "../game/franchiseFeatures";
import { submitPlayoffGame, simulatePlayoffsAsync } from "../game/playoffs";
import type { PlayoffMode } from "../game/playoffTypes";
import type { GameState, Run } from "../game/types";
import { parseLineup } from "../game/lineup";
type HookAction = GameAction | { type: "RESTORE_SAVED"; state: GameState };
const reducer = (state: GameState, action: HookAction) =>
  action.type === "RESTORE_SAVED" ? action.state : gameReducer(state, action);
export const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
const SET_ASIDE =
  "A copy of the original save was set aside in Save options, so it cannot be overwritten.";
/**
 * A fully validated save becomes the last-known-good backup. A rejected one is
 * moved to its own key first, so continuing to play cannot overwrite it.
 */
function settleLoad(
  storage: StorageLike,
  loaded: LoadedGame,
  source: string | null,
): LoadedGame {
  if (source === null) return loaded;
  if (loaded.notice === null) {
    keepVerifiedCopy(storage, STORAGE_KEY, source);
    return loaded;
  }
  if (loaded.preserveSource && setAsideRejected(storage, STORAGE_KEY, source))
    return {
      ...loaded,
      notice: loaded.notice.replace(/ The original [^.]*\.$/, ` ${SET_ASIDE}`),
    };
  return loaded;
}
const describeGame = (state: GameState) =>
  state.franchise
    ? `Franchise year ${state.franchise.year}, ${state.franchise.phase}.`
    : `A ${state.run.mode} draft${state.run.result ? " with a completed season" : ""}.`;
export function useGame(
  initial?: GameState,
  storage: StorageLike = browserStorage,
) {
  const [loaded] = useState(() => {
    if (initial)
      return {
        state: initial,
        notice: null,
        roster: null,
        confirmImport: false,
        restore: undefined,
        preserveSource: false,
        source: null,
        seed: 0,
        verified: false,
      };
    const seed = newSeed();
    let source: string | null = null;
    try {
      source = savedGameSource(storage);
    } catch {
      // prepareGameLoad reports unavailable storage.
    }
    const prepared = prepareGameLoad(storage, seed, "all");
    const loaded = prepared.restore
      ? prepared
      : { ...prepared, ...settleLoad(storage, prepared, source) };
    const roster = parseLineup(window.location.search);
    const hasProgress =
      Object.values(loaded.state.run.roster).some((id) => id !== null) ||
      loaded.state.run.rerollsLeft < 2;
    if (roster && !hasProgress) {
      const fresh = gameReducer(loaded.state, {
        type: "NEW_RUN",
        mode: "free",
        includeLegends: true,
        ...(Object.values(roster).some((id) => id !== null && id > 251)
          ? { draftPool: "all" as const }
          : {}),
        seed: newSeed(),
      });
      loaded.state = gameReducer(fresh, { type: "SET_LINEUP", roster });
      // A valid shared-lineup URL explicitly replaces an unusable save.
      // Enable persistence for the imported draft and its later season.
      if (source !== null && (loaded.preserveSource || loaded.restore))
        setAsideRejected(storage, STORAGE_KEY, source);
      loaded.preserveSource = false;
      loaded.restore = undefined;
      loaded.notice = null;
    }
    return {
      ...loaded,
      roster,
      confirmImport: !!roster && hasProgress,
      source,
      seed,
      // Already stored exactly as validated; rewriting it unchanged would
      // only signal other open tabs that this save had changed.
      verified:
        source !== null &&
        !loaded.restore &&
        loaded.notice === null &&
        !loaded.preserveSource &&
        !(roster && !hasProgress),
    };
  });
  const [state, rawDispatch] = useReducer(reducer, loaded.state);
  const latestState = useRef(state);
  latestState.current = state;
  const recordedSources = useRef(new WeakSet<Run>());
  const busy = useRef(!!loaded.restore);
  const [restoring, setRestoring] = useState(!!loaded.restore);
  const [canSave, setCanSave] = useState(
    !loaded.restore && !loaded.preserveSource,
  );
  const [restorationProgress, setRestorationProgress] = useState({
    completed: 0,
    total: 1230,
  });
  const [storageNotice, setStorageNotice] = useState<string | null>(
    loaded.notice,
  );
  const restoredOnce = useRef(false);
  const lastPersistedState = useRef<GameState | null>(
    loaded.verified ? loaded.state : null,
  );
  useEffect(() => {
    // Development refresh reruns effects while retaining hook state. Never
    // replay the mount-time snapshot over progress made since restoration.
    if (!loaded.restore || restoredOnce.current) return;
    const controller = new AbortController();
    busy.current = true;
    void restoreSavedGame(
      loaded,
      loaded.source ?? "",
      loaded.seed,
      (completed, total) => {
        if (!controller.signal.aborted)
          setRestorationProgress({ completed, total });
      },
      controller.signal,
    )
      .then((result) => {
        if (controller.signal.aborted) return;
        const restored = settleLoad(storage, result, loaded.source);
        if (restored.notice === null && !restored.preserveSource)
          lastPersistedState.current = restored.state;
        restoredOnce.current = true;
        rawDispatch({ type: "RESTORE_SAVED", state: restored.state });
        setStorageNotice(restored.notice);
        setCanSave(!restored.preserveSource && restored.notice === null);
        busy.current = false;
        setRestoring(false);
      })
      .catch(() => {
        // Cleanup aborts stale StrictMode mounts and unmounted restorations.
        // Validation failures are returned as a recoverable LoadedGame notice.
      });
    return () => controller.abort();
  }, [loaded, storage]);
  const otherTab = useOtherTabChanges(STORAGE_KEY);
  useEffect(
    () =>
      isSaveStorage(storage)
        ? storage.subscribe(({ key, error }) => {
            if (key === STORAGE_KEY) setStorageNotice(error);
          })
        : undefined,
    [storage],
  );
  const [simulating, setSimulating] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 1230 });
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [playoffSimulating, setPlayoffSimulating] = useState(false);
  const [playoffProgress, setPlayoffProgress] = useState({
    completed: 0,
    total: 105,
  });
  const playoffController = useRef<AbortController | null>(null);
  useEffect(() => () => playoffController.current?.abort(), []);
  const dispatch = (action: GameAction) => {
    if (!busy.current) {
      setCanSave(true);
      rawDispatch(action);
    }
  };
  const seasonController = useRef<AbortController | null>(null);
  useEffect(() => () => seasonController.current?.abort(), []);
  const advanceSeason = async (
    rounds = 1,
    played?: OfficialGame,
    expected?: Run,
  ) => {
    const source = state.run;
    if (
      busy.current ||
      source !== latestState.current.run ||
      source.result ||
      latestState.current.franchise?.phase !== "season" ||
      recordedSources.current.has(source) ||
      (expected && expected !== source)
    ) {
      if (played)
        throw new Error(
          "This game no longer matches the active franchise season.",
        );
      return;
    }
    const controller = new AbortController();
    seasonController.current = controller;
    busy.current = true;
    setSimulating(true);
    setSimulationError(null);
    try {
      const run = await advanceFranchiseSeasonAsync(
        source,
        rounds,
        (completed, total) => {
          if (!controller.signal.aborted) setProgress({ completed, total });
        },
        controller.signal,
        played,
      );
      controller.signal.throwIfAborted();
      if (
        latestState.current.run !== source ||
        latestState.current.franchise?.phase !== "season"
      )
        throw new Error(
          "The franchise changed while this game was being recorded.",
        );
      recordedSources.current.add(source);
      setCanSave(true);
      rawDispatch({ type: "APPLY_FRANCHISE_RUN", source, run });
    } catch (error) {
      if (!controller.signal.aborted)
        setSimulationError(
          error instanceof Error
            ? error.message
            : "Season advancement failed. Please try again.",
        );
      if (played) throw error;
    } finally {
      if (!controller.signal.aborted) {
        busy.current = false;
        seasonController.current = null;
        setSimulating(false);
      }
    }
  };
  const recordPlayoffGame = async (game: OfficialGame, source: Run) => {
    if (
      busy.current ||
      latestState.current.run !== source ||
      recordedSources.current.has(source) ||
      !source.result?.league ||
      latestState.current.franchise?.phase !== "season"
    )
      throw new Error(
        "This game no longer matches the active playoff bracket.",
      );
    const playoffs = submitPlayoffGame(
      source.result.league,
      source.seasonSeed,
      source.playoffs,
      game,
    );
    recordedSources.current.add(source);
    setCanSave(true);
    rawDispatch({ type: "APPLY_PLAYOFFS", source, playoffs });
  };
  const simulate = async () => {
    if (state.franchise?.phase === "season") return advanceSeason(82);
    if (busy.current || state.run.result) return;
    busy.current = true;
    setSimulating(true);
    setSimulationError(null);
    const source = state.run;
    try {
      const result = await simulateSeasonAsync(source, (completed, total) =>
        setProgress({ completed, total }),
      );
      rawDispatch({ type: "APPLY_SEASON", source, result });
    } catch (error) {
      setSimulationError(
        error instanceof Error
          ? error.message
          : "The simulation could not finish. Please try again.",
      );
    } finally {
      busy.current = false;
      setSimulating(false);
    }
  };
  const advancePlayoffs = async (mode: PlayoffMode) => {
    const source = state.run;
    const league = source.result?.league;
    if (
      busy.current ||
      ![3, 4, 5, 6].includes(source.result?.modelVersion ?? 0) ||
      !league ||
      source.playoffs?.championId != null
    )
      return;
    const controller = new AbortController();
    playoffController.current = controller;
    busy.current = true;
    setPlayoffSimulating(true);
    setSimulationError(null);
    try {
      const playoffs = await simulatePlayoffsAsync(
        league,
        source.seasonSeed,
        source.playoffs,
        mode,
        (completed, total) => {
          if (!controller.signal.aborted)
            setPlayoffProgress({ completed, total });
        },
        controller.signal,
      );
      controller.signal.throwIfAborted();
      // Persist only a completed user action, including an explicit restart
      // after recovering a damaged playoff extension.
      setCanSave(true);
      rawDispatch({ type: "APPLY_PLAYOFFS", source, playoffs });
    } catch (error) {
      if (!controller.signal.aborted)
        setSimulationError(
          error instanceof Error
            ? error.message
            : "The playoffs could not finish. Please try again.",
        );
    } finally {
      if (!controller.signal.aborted) {
        playoffController.current = null;
        busy.current = false;
        setPlayoffSimulating(false);
      }
    }
  };
  const [importPending, setImportPending] = useState(loaded.confirmImport);
  const resolveImport = (accept: boolean) => {
    if (busy.current) return;
    if (accept && loaded.roster) {
      dispatch({
        type: "NEW_RUN",
        mode: "free",
        includeLegends: true,
        ...(Object.values(loaded.roster).some((id) => id !== null && id > 251)
          ? { draftPool: "all" as const }
          : {}),
        seed: newSeed(),
      });
      dispatch({ type: "SET_LINEUP", roster: loaded.roster });
    }
    setImportPending(false);
  };
  useEffect(() => {
    if (!loaded.roster || importPending || restoring) return;
    // Consume the import after mounting so refresh restores subsequent edits.
    const url = new URL(window.location.href);
    url.searchParams.delete("lineup");
    window.history.replaceState(null, "", url);
  }, [loaded.roster, importPending, restoring]);
  useEffect(() => {
    if (
      restoring ||
      !canSave ||
      otherTab ||
      lastPersistedState.current === state
    )
      return;
    const saved = saveGame(storage, state);
    // Effects can rerun without a game action during development refresh.
    // An idle preview must not overwrite another tab's newer saved progress.
    if (saved.notice === null) lastPersistedState.current = state;
    setStorageNotice(saved.notice);
  }, [state, storage, restoring, canSave, otherTab]);
  const retrySave =
    canSave && !restoring && !otherTab
      ? () => {
          const saved = saveGame(storage, state);
          if (saved.notice === null) lastPersistedState.current = state;
          setStorageNotice(saved.notice);
        }
      : undefined;
  const saveControls: SaveControls = {
    kind: "game",
    slot: STORAGE_KEY,
    storage,
    busy: restoring || simulating || playoffSimulating,
    otherTab,
    exportSave: () => JSON.stringify(latestState.current),
    checkImport: async (source, onProgress, signal) => {
      const checked = await validateGameSource(
        source,
        newSeed(),
        onProgress,
        signal,
      );
      if (checked.notice !== null)
        throw new Error(
          "This save could not be fully verified, so nothing was changed.",
        );
      return {
        summary: describeGame(checked.state),
        apply: () => {
          if (busy.current) return;
          rawDispatch({ type: "RESTORE_SAVED", state: checked.state });
          setCanSave(true);
          setStorageNotice(null);
          keepVerifiedCopy(storage, STORAGE_KEY, source);
        },
      };
    },
  };
  return {
    state,
    dispatch,
    saveControls,
    storageNotice,
    importPending,
    resolveImport,
    simulate,
    advanceSeason,
    recordPlayoffGame,
    retrySave,
    simulating,
    progress,
    advancePlayoffs,
    playoffSimulating,
    playoffProgress,
    simulationError,
    restoring,
    restorationProgress,
  };
}
