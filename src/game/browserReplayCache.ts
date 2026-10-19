import revision from "virtual:replay-cache-revision";
import { ReplayCache } from "./replayCache";
import { indexedReplayRecords } from "./replayCacheStorage";

let cache: ReplayCache | undefined;
/** Optional in workers and the page; unavailable APIs retain the normal replay. */
export function browserReplayCache(): ReplayCache | undefined {
  if (!globalThis.crypto?.subtle || typeof indexedDB === "undefined") return;
  return (cache ??= new ReplayCache(
    indexedReplayRecords(indexedDB),
    globalThis.crypto,
    revision,
  ));
}
