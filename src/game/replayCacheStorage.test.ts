import { webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { ReplayCache } from "./replayCache";
import {
  indexedReplayRecords,
  REPLAY_CACHE_DATABASE,
} from "./replayCacheStorage";

it("treats a blocked cache database as a miss without reading a pending request's error or reopening per year", async () => {
  let callbackError: unknown;
  const databases: string[] = [];
  const request = {
    onblocked: null as (() => void) | null,
    get error() {
      throw new DOMException("Request pending", "InvalidStateError");
    },
  };
  const factory = {
    open(name: string) {
      databases.push(name);
      queueMicrotask(() => {
        try {
          request.onblocked?.();
        } catch (error) {
          callbackError = error;
        }
      });
      return request;
    },
  } as unknown as IDBFactory;
  const cache = new ReplayCache(
    indexedReplayRecords(factory),
    webcrypto as unknown as Crypto,
    "rules",
  );
  expect(
    await Promise.race([
      cache.get("solo-archive", "year-one"),
      new Promise((resolve) => setTimeout(() => resolve("stalled"), 1000)),
    ]),
  ).toBeUndefined();
  expect(await cache.get("solo-archive", "year-two")).toBeUndefined();
  expect(callbackError).toBeUndefined();
  expect(databases).toEqual([REPLAY_CACHE_DATABASE]);
});
