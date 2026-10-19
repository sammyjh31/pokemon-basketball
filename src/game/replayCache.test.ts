import { webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { ReplayCache } from "./replayCache";

const crypto = webcrypto as unknown as Crypto;
async function cache(durable = memoryReplayRecords(), revision = "engine-one") {
  return {
    durable,
    cache: new ReplayCache(durable.connect(), crypto, revision),
  };
}

it("reopens an exact verified snapshot through another store connection with an independent copy", async () => {
  const first = await cache();
  const snapshot = { history: [{ year: 1, wins: 57 }], points: 8123 };
  await first.cache.put("solo-active", "unchanged source", snapshot);
  snapshot.history[0].wins = 0;
  const second = await cache(first.durable);
  const loaded = await second.cache.get<typeof snapshot>(
    "solo-active",
    "unchanged source",
  );
  expect(loaded).toEqual({ history: [{ year: 1, wins: 57 }], points: 8123 });
  loaded!.history[0].wins = 1;
  expect(await second.cache.get("solo-active", "unchanged source")).toEqual({
    history: [{ year: 1, wins: 57 }],
    points: 8123,
  });
  expect((await first.durable.key())!.extractable).toBe(false);
  await expect(
    crypto.subtle.exportKey("raw", (await first.durable.key())!),
  ).rejects.toThrow();
});

it.each(["input", "namespace", "revision"])(
  "does not accept evidence for another %s",
  async (change) => {
    const first = await cache();
    await first.cache.put("solo-active", "source-a", { points: 8123 });
    first.durable.substitute([...first.durable.records.values()][0]);
    const second = await cache(
      first.durable,
      change === "revision" ? "engine-two" : "engine-one",
    );
    expect(
      await second.cache.get(
        change === "namespace" ? "local-season" : "solo-active",
        change === "input" ? "source-b" : "source-a",
      ),
    ).toBeUndefined();
  },
);

it.each(["payload", "signature"])(
  "ignores a damaged %s instead of returning changed results",
  async (part) => {
    const first = await cache();
    await first.cache.put("solo-active", "source", { points: 8123 });
    const record = [...first.durable.records.values()][0];
    if (part === "payload") record.payload = '{"points":99999}';
    else record.signature = "0".repeat(64);
    expect(await first.cache.get("solo-active", "source")).toBeUndefined();
  },
);

it("treats unavailable storage and failed writes as misses without rejecting the load", async () => {
  const first = await cache();
  first.durable.fail(true);
  await expect(
    first.cache.put("solo-archive", "year", true),
  ).resolves.toBeUndefined();
  await expect(
    first.cache.get("solo-archive", "year"),
  ).resolves.toBeUndefined();
});

it("does not retain oversized derived snapshots", async () => {
  const first = await cache();
  await first.cache.put("solo-active", "large", {
    box: "x".repeat(8 * 1024 * 1024),
  });
  expect(await first.cache.get("solo-active", "large")).toBeUndefined();
  expect(first.durable.records.size).toBe(0);
});
