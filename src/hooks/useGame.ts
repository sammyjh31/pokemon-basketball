import { useEffect, useReducer, useState } from "react";
import { gameReducer } from "../game/state";
import { loadGame, saveGame, type StorageLike } from "../game/persistence";
import type { GameState } from "../game/types";
const browserStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
export const newSeed = () => crypto.getRandomValues(new Uint32Array(1))[0];
export function useGame(
  initial?: GameState,
  storage: StorageLike = browserStorage,
) {
  const [loaded] = useState(() =>
    initial ? { state: initial, notice: null } : loadGame(storage, newSeed()),
  );
  const [state, dispatch] = useReducer(gameReducer, loaded.state);
  const [storageNotice, setStorageNotice] = useState<string | null>(
    loaded.notice,
  );
  useEffect(() => {
    const saved = saveGame(storage, state);
    if (saved.notice) setStorageNotice(saved.notice);
  }, [state, storage]);
  return { state, dispatch, storageNotice };
}
