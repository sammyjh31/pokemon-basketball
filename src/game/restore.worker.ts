import { prepareGameLoad, STORAGE_KEY, type LoadedGame } from "./persistence";
import { simulateLocalSeasonAsync } from "./localSeason";
import { simulateCachedLocalSeason } from "./localCareerCache";
import type { LocalLeague } from "./localLeague";
import { browserReplayCache } from "./browserReplayCache";

export type RestoreJob =
  | { kind: "game"; source: string; seed: number }
  | { kind: "local-season"; draft: LocalLeague };
export type RestoreMessage =
  | { progress: [number, number] }
  | { loaded: LoadedGame }
  | { season: Awaited<ReturnType<typeof simulateLocalSeasonAsync>> }
  | { error: string };

const post = (message: RestoreMessage) => self.postMessage(message);
const progress = (completed: number, total: number) =>
  post({ progress: [completed, total] });

/** Runs the same validation and replay code as the page, off the main thread. */
self.onmessage = async ({ data }: MessageEvent<RestoreJob>) => {
  const signal = new AbortController().signal;
  try {
    if (data.kind === "local-season") {
      post({
        season: await simulateCachedLocalSeason(
          data.draft,
          progress,
          signal,
          browserReplayCache(),
        ),
      });
      return;
    }
    const storage = {
      getItem: (key: string) => (key === STORAGE_KEY ? data.source : null),
      setItem: () => {},
    };
    const { restore, ...prepared } = prepareGameLoad(storage, data.seed);
    post({
      loaded: restore
        ? await restore(progress, signal, browserReplayCache())
        : prepared,
    });
  } catch (error) {
    post({ error: error instanceof Error ? error.message : String(error) });
  }
};
