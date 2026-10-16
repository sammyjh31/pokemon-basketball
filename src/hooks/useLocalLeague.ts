import { useEffect, useRef, useState } from "react";
import {
  LOCAL_LEAGUE_KEY,
  advanceLocalCpu,
  parseLocalLeague,
  type LocalLeague,
} from "../game/localLeague";
import { simulateLocalSeasonInWorker } from "../game/restoreClient";
import { localSeasonSeed } from "../game/localCareer";
import {
  playoffGameCount,
  replayPlayoffs,
  simulatePlayoffsAsync,
} from "../game/playoffs";
import type { PlayoffMode, Playoffs } from "../game/playoffTypes";
import type { SeasonResult } from "../game/types";
import {
  needsBackgroundLocalRestore,
  restoreLocalLeagueInBackground,
} from "../game/localLeagueRestore";
import {
  browserStorage,
  isSaveStorage,
  keepVerifiedCopy,
  setAsideRejected,
  type StorageLike,
} from "../game/saveStorage";
import type { SaveControls } from "../components/SaveMenu";
import { useOtherTabChanges } from "./useOtherTabChanges";

const SET_ASIDE = "A copy was set aside in Save options.";

export function useLocalLeague(storage: StorageLike = browserStorage) {
  const [loaded] = useState(() => {
    let raw: string | null = null;
    try {
      raw = storage.getItem(LOCAL_LEAGUE_KEY);
      if (raw && needsBackgroundLocalRestore(raw))
        return { draft: null, notice: "", backgroundRaw: raw, source: null };
      const draft = raw ? advanceLocalCpu(parseLocalLeague(raw)) : null;
      // Parsing fully validates an unfinished league. A completed season is
      // backed up only once its replay succeeds.
      if (raw && draft && !draft.completed)
        keepVerifiedCopy(storage, LOCAL_LEAGUE_KEY, raw);
      return {
        draft,
        notice: "",
        backgroundRaw: null,
        source: draft?.completed ? raw : null,
      };
    } catch {
      const setAside =
        !!raw && setAsideRejected(storage, LOCAL_LEAGUE_KEY, raw);
      return {
        draft: null,
        notice: setAside
          ? "Your saved local league could not be loaded. A copy was set aside in Save options, so starting a new draft cannot overwrite it."
          : "Your saved local league could not be loaded. Its saved data is unchanged. Starting a new draft will replace it.",
        backgroundRaw: null,
        source: null,
      };
    }
  });
  const pendingBackup = useRef(
    loaded.draft && loaded.source
      ? { draft: loaded.draft, source: loaded.source }
      : null,
  );
  // Rewriting a just-loaded league unchanged would only tell other open tabs
  // that it changed.
  const unchanged = useRef(loaded.draft ? JSON.stringify(loaded.draft) : null);
  const otherTab = useOtherTabChanges(LOCAL_LEAGUE_KEY);
  const [restoreCount, setRestoreCount] = useState(0);
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
    const raw = loaded.backgroundRaw;
    const active = new AbortController();
    controller.current = active;
    setBusy(true);
    void restoreLocalLeagueInBackground(
      raw,
      active.signal,
      (completed, total) => {
        if (controller.current === active && !active.signal.aborted)
          setRestoration({ status: "loading", completed, total });
      },
    )
      .then((verified) => {
        if (controller.current !== active || active.signal.aborted) return;
        controller.current = null;
        if (verified.completed)
          pendingBackup.current = { draft: verified, source: raw };
        else keepVerifiedCopy(storage, LOCAL_LEAGUE_KEY, raw);
        unchanged.current = JSON.stringify(verified);
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
        // Only a save the worker rejected is set aside, not a worker that
        // failed to start.
        const rejected =
          error instanceof Error &&
          !/^Background verification|cannot verify saved careers/.test(
            error.message,
          ) &&
          setAsideRejected(storage, LOCAL_LEAGUE_KEY, raw);
        setError(
          `${error instanceof Error ? error.message : "This saved local league could not be verified."} Your original saved data is unchanged.${rejected ? ` ${SET_ASIDE}` : ""}`,
        );
      })
      .finally(() => {
        if (controller.current === active) {
          controller.current = null;
          setBusy(false);
        }
      });
    return () => active.abort();
  }, [loaded, restoreAttempt, storage]);
  useEffect(() => {
    // Completed saves are not trusted until both season and playoff replay succeed.
    if (restoration || !draft || (draft.completed && !result) || otherTab)
      return;
    const text = JSON.stringify(draft);
    if (text === unchanged.current) return;
    unchanged.current = null;
    try {
      storage.setItem(LOCAL_LEAGUE_KEY, text);
      setNotice("");
    } catch {
      setNotice(
        "Could not save this local league in your browser. You can keep playing, but refreshing or leaving may lose progress.",
      );
    }
  }, [draft, storage, result, restoration, otherTab]);
  useEffect(
    () =>
      isSaveStorage(storage)
        ? storage.subscribe(({ key, error }) => {
            if (key === LOCAL_LEAGUE_KEY) setNotice(error ?? "");
          })
        : undefined,
    [storage],
  );
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
      const played = await simulateLocalSeasonInWorker(
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
      if (pendingBackup.current?.draft === source) {
        keepVerifiedCopy(
          storage,
          LOCAL_LEAGUE_KEY,
          pendingBackup.current.source,
        );
        pendingBackup.current = null;
      }
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
  }, [draft?.completed, draft?.career?.year, restoreCount]);
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
    if (otherTab) return;
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
  const saveControls: SaveControls = {
    kind: "local-league",
    slot: LOCAL_LEAGUE_KEY,
    storage,
    busy: busy || restoration?.status === "loading",
    otherTab,
    exportSave: () => (draft ? JSON.stringify(draft) : null),
    checkImport: async (source, onProgress, signal) => {
      // Careers with chemistry growth replay their history to validate, so
      // they are checked in the same background worker as loading.
      const parsed = needsBackgroundLocalRestore(source)
        ? await restoreLocalLeagueInBackground(source, signal, onProgress)
        : parseLocalLeague(source);
      const imported = advanceLocalCpu(parsed);
      return {
        summary: `Local league year ${imported.career?.year ?? 1} with ${imported.managers.length} ${imported.managers.length === 1 ? "manager" : "managers"}.`,
        apply: () => {
          if (controller.current) return;
          if (imported.completed)
            pendingBackup.current = { draft: imported, source };
          else keepVerifiedCopy(storage, LOCAL_LEAGUE_KEY, source);
          unchanged.current = null;
          setRestoration(null);
          setResult(null);
          setPlayoffs(undefined);
          setError("");
          setNotice("");
          setDraft(imported);
          setRestoreCount((count) => count + 1);
        },
      };
    },
  };
  return {
    draft,
    saveControls,
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
