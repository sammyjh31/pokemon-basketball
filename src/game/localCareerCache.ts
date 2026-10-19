import {
  advanceLocalCpu,
  localLeagueRun,
  parseLocalLeague,
  LOCAL_SAVE_MAX_LENGTH,
  type LocalLeague,
} from "./localLeague";
import { LOCAL_MAX_YEARS } from "./localFormat";
import {
  currentLocalSeasonInputs,
  simulateLocalSeasonAsync,
  simulateLocalSeasonInputsAsync,
} from "./localSeason";
import { simulateSeasonAsync } from "./season";
import type {
  LocalArchiveEvidence,
  LocalReplayContext,
} from "./localReplayEvidence";
import type { ReplayCache } from "./replayCache";
import type { SeasonResult } from "./types";

const yearInput = (format: unknown, archive: unknown) =>
  JSON.stringify({ format, archive });

/** Cache evidence never replaces source parsing or cross-year roster validation. */
export async function restoreLocalCareerSource(
  source: string,
  onProgress: (completed: number, total: number) => void,
  signal: AbortSignal,
  cache?: ReplayCache,
) {
  signal.throwIfAborted();
  // Retain the parser's bound before any untrusted JSON or cache work.
  if (source.length > LOCAL_SAVE_MAX_LENGTH) parseLocalLeague(source);
  const raw = JSON.parse(source);
  const years: unknown[] =
    Array.isArray(raw?.career?.history) &&
    raw.career.history.length <= LOCAL_MAX_YEARS
      ? raw.career.history
      : [];
  const inputs = new Map<number, string>();
  const verified = new Map<number, LocalArchiveEvidence>();
  const context: LocalReplayContext = {
    verified,
    captured: new Map(),
    used: new Set(),
    signal,
  };
  if (cache) {
    for (const [index, year] of years.entries()) {
      signal.throwIfAborted();
      const input = yearInput(raw?.options?.format, year);
      inputs.set(index + 1, input);
      const evidence = await cache.get<LocalArchiveEvidence>(
        "local-archive",
        input,
      );
      if (evidence) verified.set(index + 1, evidence);
    }
  }
  signal.throwIfAborted();
  const draft = advanceLocalCpu(parseLocalLeague(source, onProgress, context));
  signal.throwIfAborted();
  if (cache) {
    for (const [year, evidence] of context.captured) {
      signal.throwIfAborted();
      const input = inputs.get(year)!;
      await cache.put("local-archive", input, evidence);
      const normalized = yearInput(
        draft.options!.format,
        draft.career!.history[year - 1],
      );
      if (normalized !== input)
        await cache.put("local-archive", normalized, evidence);
    }
  }
  signal.throwIfAborted();
  return {
    draft,
    replayedYears: [...context.captured.keys()],
    cachedYears: [...context.used],
  };
}

/** Reuses actual game inputs, so completing games/playoffs does not reroll a season. */
export async function simulateCachedLocalSeason(
  draft: LocalLeague,
  onProgress: (completed: number, total: number) => void,
  signal: AbortSignal,
  cache?: ReplayCache,
): Promise<SeasonResult> {
  signal.throwIfAborted();
  if (!cache) return simulateLocalSeasonAsync(draft, onProgress, signal);
  // Own exactly what will run before the first cache await. UI/other callers
  // cannot change inputs after they have been hashed but before simulation.
  const custom = draft.options
    ? structuredClone(currentLocalSeasonInputs(draft))
    : undefined;
  const classic = custom ? undefined : structuredClone(localLeagueRun(draft));
  const input = JSON.stringify(custom ?? classic);
  const remembered = await cache.get<SeasonResult>("local-season", input);
  signal.throwIfAborted();
  if (remembered) {
    onProgress(0, 0);
    return remembered;
  }
  const season = custom
    ? await simulateLocalSeasonInputsAsync(custom, onProgress, signal)
    : await simulateSeasonAsync(classic!, onProgress, signal);
  signal.throwIfAborted();
  await cache.put("local-season", input, season);
  signal.throwIfAborted();
  return season;
}
