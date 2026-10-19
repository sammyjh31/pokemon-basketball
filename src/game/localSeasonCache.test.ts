import { createHash, webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { localCareerFixture } from "./localReplayCache.testUtils";
import { startNextLocalSeason } from "./localCareer";
import { simulateCachedLocalSeason } from "./localCareerCache";
import { simulateLocalSeason } from "./localSeason";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";

const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
it("keeps the requested game inputs frozen while an asynchronous cache lookup is pending", async () => {
  const draft = startNextLocalSeason(localCareerFixture(1));
  const original = structuredClone(draft);
  const expected = simulateLocalSeason(original);
  const records = memoryReplayRecords().connect();
  let changed = false;
  const cache = new ReplayCache(
    {
      ...records,
      read: async (id) => {
        if (!changed) {
          changed = true;
          draft.career!.teams[0].tactic =
            draft.career!.teams[0].tactic === "interior"
              ? "balanced"
              : "interior";
        }
        return records.read(id);
      },
    },
    webcrypto as unknown as Crypto,
    "rules",
  );
  const result = await simulateCachedLocalSeason(
    draft,
    () => {},
    new AbortController().signal,
    cache,
  );
  expect(sha(result)).toBe(sha(expected));
  const progress: [number, number][] = [];
  const reopened = await simulateCachedLocalSeason(
    original,
    (done, total) => progress.push([done, total]),
    new AbortController().signal,
    cache,
  );
  expect(sha(reopened)).toBe(sha(expected));
  expect(progress).toEqual([[0, 0]]);
}, 60000);
