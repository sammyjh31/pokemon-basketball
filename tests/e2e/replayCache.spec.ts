import { expect, test } from "@playwright/test";
import type { ReplayCacheRecord } from "../../src/game/replayCache";
import { asReturningPlayer } from "./returningPlayer";
test.beforeEach(({ page }) => asReturningPlayer(page));

test("shares a durable private cache key across concurrent connections and reloads", async ({
  page,
}) => {
  await page.goto("/");
  const values = await page.evaluate(async () => {
    const cachePath = "/src/game/replayCache.ts",
      storagePath = "/src/game/replayCacheStorage.ts";
    const { ReplayCache } = await import(cachePath);
    const { indexedReplayRecords } = await import(storagePath);
    const name = "pokebb-concurrent-replay-e2e";
    const first = new ReplayCache(
      indexedReplayRecords(indexedDB, name),
      crypto,
      "engine",
    );
    const second = new ReplayCache(
      indexedReplayRecords(indexedDB, name),
      crypto,
      "engine",
    );
    await Promise.all([
      first.put("solo-active", "first-source", { points: 123 }),
      second.put("solo-active", "second-source", { points: 456 }),
    ]);
    return [
      await second.get("solo-active", "first-source"),
      await first.get("solo-active", "second-source"),
    ];
  });
  expect(values).toEqual([{ points: 123 }, { points: 456 }]);
  await page.reload();
  const reopened = await page.evaluate(async () => {
    const cachePath = "/src/game/replayCache.ts",
      storagePath = "/src/game/replayCacheStorage.ts";
    const { ReplayCache } = await import(cachePath);
    const { indexedReplayRecords } = await import(storagePath);
    const cache = new ReplayCache(
      indexedReplayRecords(indexedDB, "pokebb-concurrent-replay-e2e"),
      crypto,
      "engine",
    );
    return [
      await cache.get("solo-active", "first-source"),
      await cache.get("solo-active", "second-source"),
    ];
  });
  expect(reopened).toEqual(values);
});

test("evicts cache snapshots by count and storage budget without touching source slots", async ({
  page,
}) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const cachePath = "/src/game/replayCache.ts",
      storagePath = "/src/game/replayCacheStorage.ts";
    const { ReplayCache, REPLAY_CACHE_LIMIT } = await import(cachePath);
    const { indexedReplayRecords } = await import(storagePath);
    const name = "pokebb-bounded-replay-e2e";
    const records = indexedReplayRecords(indexedDB, name);
    let writtenAt = 0;
    const cache = new ReplayCache(
      {
        ...records,
        // Browser clock precision can give consecutive writes equal ages.
        // Model a known chronological order for the oldest-entry assertion.
        write: (id: string, record: ReplayCacheRecord) =>
          records.write(id, { ...record, updated: ++writtenAt }),
      },
      crypto,
      "engine",
    );
    localStorage.setItem("cache-e2e-source", "full history");
    for (let i = 0; i < 3; i++)
      await cache.put("solo-active", `run-${i}`, { points: i });
    const oldest = await cache.get("solo-active", "run-0");
    const newest = await cache.get("solo-active", "run-2");
    await cache.put("solo-archive", "retained-year", true);
    const large = "x".repeat(6 * 1024 * 1024);
    for (let i = 0; i < 6; i++)
      await cache.put("local-archive", `year-${i}`, large);
    const bytes = await new Promise<number>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("records", "readonly");
        const rows = tx.objectStore("records").getAll();
        tx.oncomplete = () => {
          resolve(rows.result.reduce((sum, row) => sum + (row.bytes ?? 0), 0));
          db.close();
        };
      };
    });
    return {
      oldest: oldest ?? null,
      newest,
      bytes,
      limit: REPLAY_CACHE_LIMIT,
      source: localStorage.getItem("cache-e2e-source"),
      historicalProof: await cache.get("solo-archive", "retained-year"),
    };
  });
  expect(result.oldest).toBeNull();
  expect(result.newest).toEqual({ points: 2 });
  expect(result.bytes).toBeLessThanOrEqual(result.limit);
  expect(result.source).toBe("full history");
  expect(result.historicalProof).toBe(true);
});
