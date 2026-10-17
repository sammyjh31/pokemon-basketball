import { useEffect, useRef, useState } from "react";
import {
  LOCAL_LEAGUE_KEY,
  advanceLocalCpu,
  parseLocalLeague,
  type LocalLeague,
} from "../game/localLeague";
import { simulateLocalSeasonAsync } from "../game/localSeason";
import { localSeasonSeed } from "../game/localCareer";
import {
  playoffGameCount,
  replayPlayoffs,
  simulatePlayoffsAsync,
} from "../game/playoffs";
import type { PlayoffMode, Playoffs } from "../game/playoffTypes";
import type { StorageLike } from "../game/persistence";
import type { SeasonResult } from "../game/types";
import {
  needsBackgroundLocalRestore,
  restoreLocalLeagueInBackground,
} from "../game/localLeagueRestore";

const browserStorage: StorageLike = {
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
};
export function useLocalLeague(storage: StorageLike = browserStorage) {
  const [loaded] = useState(() => {
    try {
      const raw = storage.getItem(LOCAL_LEAGUE_KEY);
      if (raw && needsBackgroundLocalRestore(raw))
        return { draft: null, notice: "", backgroundRaw: raw };
      return {
        draft: raw ? advanceLocalCpu(parseLocalLeague(raw)) : null,
        notice: "",
        backgroundRaw: null,
      };
    } catch {
      return {
        draft: null,
        notice:
          "Your saved local league could not be loaded. Its saved data is unchanged. Starting a new draft will replace it.",
        backgroundRaw: null,
      };
    }
  });
  const [draft, setDraft] = useState<LocalLeague | null>(loaded.draft);
  const [notice, setNotice] = useState(loaded.notice);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SeasonResult | null>(null);
  const [playoffs, setPlayoffs] = useState<Playoffs | undefined>();
  const [busy, setBusy] = useState(Boolean(loaded.backgroundRaw));
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [restoration, setRestoration] = useState<{
    status: "loading" | "cancelled" | "error";
    completed: number;
    total: number;
  } | null>(
    loaded.backgroundRaw ? { status: "loading", completed: 0, total: 0 } : null,
  );
  const [progress, setProgress] = useState({ completed: 0, total: 1230 });
  const controller = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!loaded.backgroundRaw) return;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    void restoreLocalLeagueInBackground(
      loaded.backgroundRaw,
      active.signal,
      (completed, total) => {
        if (controller.current === active && !active.signal.aborted)
          setRestoration({ status: "loading", completed, total });
      },
    )
      .then((verified) => {
        if (controller.current !== active || active.signal.aborted) return;
        controller.current = null;
        setBusy(false);
        setDraft(verified);
        setRestoration(null);
        setNotice("");
        setError("");
      })
      .catch((error) => {
        if (controller.current !== active || active.signal.aborted) return;
        setRestoration((value) => ({
          status: "error",
          completed: value?.completed ?? 0,
          total: value?.total ?? 0,
        }));
        setError(
          `${error instanceof Error ? error.message : "This saved local league could not be verified."} Your original saved data is unchanged.`,
        );
      })
      .finally(() => {
        if (controller.current === active) {
          controller.current = null;
          setBusy(false);
        }
      });
    return () => active.abort();
  }, [loaded, restoreAttempt]);
  useEffect(() => {
    // Completed saves are not trusted until both season and playoff replay succeed.
    if (restoration || !draft || (draft.completed && !result)) return;
    try {
      storage.setItem(LOCAL_LEAGUE_KEY, JSON.stringify(draft));
      setNotice("");
    } catch {
      setNotice(
        "Could not save this local league in your browser. You can keep playing, but refreshing or leaving may lose progress.",
      );
    }
  }, [draft, storage, result, restoration]);
  const change = (
    next: LocalLeague | ((current: LocalLeague) => LocalLeague),
  ) => {
    if (controller.current || restoration) return;
    try {
      const updated =
        typeof next === "function" ? (draft ? next(draft) : null) : next;
      if (
        updated &&
        (updated.career?.year ?? 1) !== (draft?.career?.year ?? 1)
      ) {
        setResult(null);
        setPlayoffs(undefined);
      }
      setDraft(updated ? advanceLocalCpu(updated) : null);
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to update this league.",
      );
    }
  };
  const simulate = async () => {
    if (!draft || controller.current || result) return;
    const source = draft;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    try {
      const played = await simulateLocalSeasonAsync(
        source,
        (completed, total) => {
          if (!active.signal.aborted) setProgress({ completed, total });
        },
        active.signal,
      );
      active.signal.throwIfAborted();
      const restored =
        source.playoffGames !== undefined
          ? replayPlayoffs(
              played.league!,
              localSeasonSeed(source),
              source.playoffGames,
            )
          : undefined;
      setResult(played);
      setPlayoffs(restored);
      setDraft((current) =>
        current === source ? { ...current, completed: true } : current,
      );
    } catch (e) {
      if (!active.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "The season could not be simulated. Try again.",
        );
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  useEffect(() => {
    if (draft?.completed && !result && !controller.current) void simulate();
  }, [draft?.completed, draft?.career?.year]);
  const advancePlayoffs = async (mode: PlayoffMode) => {
    if (
      !draft?.completed ||
      !result?.league ||
      controller.current ||
      playoffs?.championId != null
    )
      return;
    const source = draft;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    setError("");
    try {
      const played = await simulatePlayoffsAsync(
        result.league,
        localSeasonSeed(source),
        playoffs,
        mode,
        (completed, total) => {
          if (!active.signal.aborted) setProgress({ completed, total });
        },
        active.signal,
      );
      active.signal.throwIfAborted();
      setPlayoffs(played);
      setDraft((current) =>
        current === source
          ? { ...current, playoffGames: playoffGameCount(played) }
          : current,
      );
    } catch (e) {
      if (!active.signal.aborted)
        setError(
          e instanceof Error
            ? e.message
            : "The playoffs could not advance. Try again.",
        );
    } finally {
      if (controller.current === active) {
        controller.current = null;
        setBusy(false);
      }
    }
  };
  const reset = () => {
    if (controller.current) return;
    setDraft(null);
    setResult(null);
    setPlayoffs(undefined);
    setRestoration(null);
    setError("");
    try {
      storage.setItem(LOCAL_LEAGUE_KEY, "");
      setNotice("");
    } catch {
      setNotice(
        "Could not clear the old local save. A new draft will try to replace it when saving is available.",
      );
    }
  };
  const cancelRestore = () => {
    if (restoration?.status !== "loading") return;
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setRestoration((value) => ({
      status: "cancelled",
      completed: value?.completed ?? 0,
      total: value?.total ?? 0,
    }));
    setNotice("Restoration cancelled. Your original saved data is unchanged.");
  };
  const retryRestore = () => {
    if (!loaded.backgroundRaw || controller.current || !restoration) return;
    setRestoration({ status: "loading", completed: 0, total: 0 });
    setNotice("");
    setError("");
    setRestoreAttempt((attempt) => attempt + 1);
  };
  return {
    draft,
    change,
    reset,
    result,
    simulate,
    playoffs,
    advancePlayoffs,
    busy,
    progress,
    notice,
    error,
    restoration,
    cancelRestore,
    retryRestore,
  };
}
