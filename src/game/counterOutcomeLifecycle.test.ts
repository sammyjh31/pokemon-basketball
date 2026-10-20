import { webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { localCareerFixture } from "./localReplayCache.testUtils";
import { restoreLocalCareerSource } from "./localCareerCache";
import { replayLocalHistory, startNextLocalSeason } from "./localCareer";
import { localLeagueTeams } from "./localLeague";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
it("carries opponent result learning through local playoffs, seasons and exact cold/warm history", async () => {
  const draft = localCareerFixture(2, 4, 4);
  const book = draft.career!.history[0].coachBook!;
  expect(
    Object.values(book.coaches).some((c) =>
      Object.values(c.opponents).some(
        (s) => Object.keys(s.counterResults?.counters ?? {}).length > 0,
      ),
    ),
  ).toBe(true);
  const seeded = draft.career!.history[1].teams[0].scoutingSeed!;
  expect(
    Object.values(seeded.opponents).some(
      (s) => Object.keys(s.scouting.counterResults?.counters ?? {}).length > 0,
    ),
  ).toBe(true);
  const records = memoryReplayRecords(),
    cache = () =>
      new ReplayCache(
        records.connect(),
        webcrypto as unknown as Crypto,
        "counter-results",
      );
  const restore = (raw: string) =>
    restoreLocalCareerSource(
      raw,
      () => {},
      new AbortController().signal,
      cache(),
    );
  const cold = await restore(JSON.stringify(draft)),
    warm = await restore(JSON.stringify(cold.draft));
  expect(warm.draft).toEqual(cold.draft);
  expect(warm.replayedYears).toEqual([]);
  expect(replayLocalHistory(warm.draft, 1)).toEqual(
    replayLocalHistory(draft, 1),
  );
  expect(
    localLeagueTeams(startNextLocalSeason(warm.draft)).every(
      (t) => t.movesetVersion === 4,
    ),
  ).toBe(true);
  const forged = structuredClone(warm.draft);
  const opponent = Object.values(
    forged.career!.history[1].teams[0].scoutingSeed!.opponents,
  ).find((p) => Object.keys(p.scouting.counterResults?.counters ?? {}).length)!;
  const row = Object.values(opponent.scouting.counterResults!.counters)[0]!;
  row.used.points += 0.1;
  await expect(restore(JSON.stringify(forged))).rejects.toThrow();
}, 300000);
