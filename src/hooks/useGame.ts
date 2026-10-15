import { useEffect, useReducer, useState } from "react";
import { gameReducer } from "../game/state";
import { loadGame, saveGame, type StorageLike } from "../game/persistence";
import type { GameState } from "../game/types";
import { parseLineup } from "../game/lineup";
const browserStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
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
      };
    const loaded = loadGame(storage, newSeed());
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
    }
    return { ...loaded, roster, confirmImport: !!roster && hasProgress };
  });
  const [state, dispatch] = useReducer(gameReducer, loaded.state);
  const [importPending, setImportPending] = useState(loaded.confirmImport);
  const resolveImport = (accept: boolean) => {
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
    if (!loaded.roster || importPending) return;
    // Consume the import after mounting so refresh restores subsequent edits.
    const url = new URL(window.location.href);
    url.searchParams.delete("lineup");
    window.history.replaceState(null, "", url);
  }, [loaded.roster, importPending]);
  const [storageNotice, setStorageNotice] = useState<string | null>(
    loaded.notice,
  );
  useEffect(() => {
    const saved = saveGame(storage, state);
    if (saved.notice) setStorageNotice(saved.notice);
  }, [state, storage]);
  return { state, dispatch, storageNotice, importPending, resolveImport };
}
