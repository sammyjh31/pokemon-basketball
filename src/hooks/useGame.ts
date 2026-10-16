import { canSelectTrainer } from "../game/coachSelection";
import { useEffect, useReducer, useState, useRef } from "react";
import { gameReducer, type GameAction } from "../game/state";
import {
  prepareGameLoad,
  saveGame,
  type StorageLike,
} from "../game/persistence";
import { simulateSeasonAsync } from "../game/season";
import { advanceFranchiseSeasonAsync } from "../game/interactiveSeason";
import type { OfficialGame } from "../game/franchiseFeatures";
import { submitPlayoffGame, simulatePlayoffsAsync } from "../game/playoffs";
import type { PlayoffMode } from "../game/playoffTypes";
import type { GameState, Run } from "../game/types";
import { parseLineup } from "../game/lineup";
const browserStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
type HookAction = GameAction | { type: "RESTORE_SAVED"; state: GameState };
const reducer = (state: GameState, action: HookAction) =>
  action.type === "RESTORE_SAVED" ? action.state : gameReducer(state, action);
export const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
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
      };
    const loaded = prepareGameLoad(storage, newSeed());
    const roster = parseLineup(window.location.search);
    const hasProgress =
      Object.values(loaded.state.run.roster).some((id) => id !== null) ||
      loaded.state.run.rerollsLeft < 2;
    if (roster && !hasProgress) {
      const fresh = gameReducer(loaded.state, {
        type: "NEW_RUN",
        mode: "free",
        includeLegends: true,
        seed: newSeed(),
      });
      loaded.state = gameReducer(fresh, { type: "SET_LINEUP", roster });
      // A valid shared-lineup URL explicitly replaces an unusable save.
      // Enable persistence for the imported draft and its later season.
      loaded.preserveSource = false;
      loaded.restore = undefined;
      loaded.notice = null;
    }
    if (
      !loaded.restore &&
      !loaded.preserveSource &&
      canSelectTrainer(loaded.state) &&
      loaded.state.franchise?.phase !== "offseason"
    )
      loaded.state = {
        ...loaded.state,
        run: { ...loaded.state.run, coachDraftRequired: true },
      };
    return { ...loaded, roster, confirmImport: !!roster && hasProgress };
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
  useEffect(() => {
    // Development refresh reruns effects while retaining hook state. Never
    // replay the mount-time snapshot over progress made since restoration.
    if (!loaded.restore || restoredOnce.current) return;
    const controller = new AbortController();
    busy.current = true;
    void loaded
      .restore((completed, total) => {
        if (!controller.signal.aborted)
          setRestorationProgress({ completed, total });
      }, controller.signal)
      .then((restored) => {
        if (controller.signal.aborted) return;
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
  }, [loaded]);
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
  const lastPersistedState = useRef<GameState | null>(null);
  useEffect(() => {
    if (restoring || !canSave || lastPersistedState.current === state) return;
    const saved = saveGame(storage, state);
    // Effects can rerun without a game action during development refresh.
    // An idle preview must not overwrite another tab's newer saved progress.
    if (saved.notice === null) lastPersistedState.current = state;
    setStorageNotice(saved.notice);
  }, [state, storage, restoring, canSave]);
  const retrySave =
    canSave && !restoring
      ? () => {
          const saved = saveGame(storage, state);
          if (saved.notice === null) lastPersistedState.current = state;
          setStorageNotice(saved.notice);
        }
      : undefined;
  return {
    state,
    dispatch,
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
