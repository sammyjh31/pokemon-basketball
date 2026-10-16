import { useEffect, useReducer, useState, useRef } from "react";
import { gameReducer, type GameAction } from "../game/state";
import {
  prepareGameLoad,
  saveGame,
  type StorageLike,
} from "../game/persistence";
import { simulateSeasonAsync } from "../game/season";
import type { GameState } from "../game/types";
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
    return { ...loaded, roster, confirmImport: !!roster && hasProgress };
  });
  const [state, rawDispatch] = useReducer(reducer, loaded.state);
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
  useEffect(() => {
    if (!loaded.restore) return;
    const controller = new AbortController();
    busy.current = true;
    void loaded
      .restore((completed, total) => {
        if (!controller.signal.aborted)
          setRestorationProgress({ completed, total });
      }, controller.signal)
      .then((restored) => {
        if (controller.signal.aborted) return;
        rawDispatch({ type: "RESTORE_SAVED", state: restored.state });
        setStorageNotice(restored.notice);
        setCanSave(restored.notice === null);
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
  const dispatch = (action: GameAction) => {
    if (!busy.current) {
      setCanSave(true);
      rawDispatch(action);
    }
  };
  const simulate = async () => {
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
  useEffect(() => {
    if (restoring || !canSave) return;
    const saved = saveGame(storage, state);
    setStorageNotice(saved.notice);
  }, [state, storage, restoring, canSave]);
  return {
    state,
    dispatch,
    storageNotice,
    importPending,
    resolveImport,
    simulate,
    simulating,
    progress,
    simulationError,
    restoring,
    restorationProgress,
  };
}
