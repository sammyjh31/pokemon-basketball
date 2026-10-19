import { createHash, webcrypto } from "node:crypto";
import { beforeAll, expect, it } from "vitest";
import { localCareerFixture } from "./localReplayCache.testUtils";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { parseLocalLeague } from "./localLeague";
import { startNextLocalSeason } from "./localCareer";
import {
  restoreLocalCareerSource,
  simulateCachedLocalSeason,
} from "./localCareerCache";
import type { LocalLeague } from "./localLeague";

const durable = memoryReplayRecords();
const connect = () =>
  new ReplayCache(
    durable.connect(),
    webcrypto as unknown as Crypto,
    "local-rules",
  );
const sha = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
let fixture: LocalLeague, source: string, baseline: LocalLeague;
async function restore(
  raw: string,
  cache = connect(),
  signal = new AbortController().signal,
) {
  return restoreLocalCareerSource(raw, () => {}, signal, cache);
}
beforeAll(() => {
  fixture = localCareerFixture();
  expect(fixture.career!.history).toHaveLength(10);
  source = JSON.stringify(fixture);
  baseline = parseLocalLeague(source);
}, 300000);

it("opens ten recorded years cold and warm with byte-identical history, mastery, morale, coaching and rosters", async () => {
  const cold = await restore(source);
  expect(sha(cold.draft)).toBe(sha(baseline));
  expect(cold.replayedYears).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const warm = await restore(source);
  expect(sha(warm.draft)).toBe(sha(cold.draft));
  expect(warm.replayedYears).toEqual([]);
  expect(warm.cachedYears).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const normalized = await restore(JSON.stringify(cold.draft));
  expect(normalized.replayedYears).toEqual([]);
  expect(sha(normalized.draft)).toBe(sha(cold.draft));
}, 300000);

it("reuses all earlier years after advancing into the next season", async () => {
  const next = startNextLocalSeason(baseline);
  expect(next.career!.year).toBe(11);
  const warm = await restore(JSON.stringify(next));
  expect(warm.replayedYears).toEqual([]);
  expect(warm.draft.career!.history).toEqual(baseline.career!.history);
  expect(warm.draft.career!.year).toBe(11);
});

it("still validates coaching chronology and never certifies a forged recorded trade", async () => {
  const changed = structuredClone(fixture);
  changed.career!.history.at(-1)!.trades.push({
    fromTeamId: 0,
    teamId: 1,
    giveId: 999999,
    receiveId: 1,
    acceptedByTeamIds: [0, 1],
  });
  const count = durable.records.size;
  await expect(restore(JSON.stringify(changed))).rejects.toThrow();
  expect(durable.records.size).toBe(count);
  const office = structuredClone(fixture);
  office.career!.coachOffice!.years[0].baseline[0] = "not-a-trainer";
  await expect(restore(JSON.stringify(office))).rejects.toThrow();
  expect(durable.records.size).toBe(count);
});

it("rejects altered news facts instead of treating a changed year as verified", async () => {
  const changed = structuredClone(fixture);
  const game = changed.career!.history[0].newsGames![0];
  game.homeScore++;
  const count = durable.records.size;
  await expect(restore(JSON.stringify(changed))).rejects.toThrow();
  expect(durable.records.size).toBe(count);
});

it("cancels before publication and leaves the original source unchanged", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(restore(source, connect(), controller.signal)).rejects.toThrow();
  expect(JSON.stringify(fixture)).toBe(source);
});

it("reuses current-season results across completion and playoff progress when the game inputs are unchanged", async () => {
  const next = startNextLocalSeason(baseline);
  const firstProgress: [number, number][] = [];
  const first = await simulateCachedLocalSeason(
    next,
    (done, total) => firstProgress.push([done, total]),
    new AbortController().signal,
    connect(),
  );
  expect(firstProgress.at(-1)).toEqual([28, 28]);
  const finished = { ...next, completed: true, playoffGames: 0 };
  const warmProgress: [number, number][] = [];
  const warm = await simulateCachedLocalSeason(
    finished,
    (done, total) => warmProgress.push([done, total]),
    new AbortController().signal,
    connect(),
  );
  expect(sha(warm)).toBe(sha(first));
  expect(warmProgress).toEqual([[0, 0]]);
  warm.league!.players[0].points++;
  expect(
    sha(
      await simulateCachedLocalSeason(
        next,
        () => {},
        new AbortController().signal,
        connect(),
      ),
    ),
  ).toBe(sha(first));
});

it("replays current-season games when a real game-plan input changes", async () => {
  const next = startNextLocalSeason(baseline);
  const changed = structuredClone(next);
  changed.career!.teams[0].tactic =
    changed.career!.teams[0].tactic === "interior" ? "balanced" : "interior";
  const progress: [number, number][] = [];
  await simulateCachedLocalSeason(
    changed,
    (done, total) => progress.push([done, total]),
    new AbortController().signal,
    connect(),
  );
  expect(progress.at(-1)).toEqual([28, 28]);
});
