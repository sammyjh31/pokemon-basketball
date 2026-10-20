import { webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { localCareerFixture } from "./localReplayCache.testUtils";
import { restoreLocalCareerSource } from "./localCareerCache";
import { replayLocalHistory, startNextLocalSeason } from "./localCareer";
import { localLeagueTeams } from "./localLeague";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
it("carries two real local years through cold/warm history and rejects edited knowledge", async () => {
  const source = localCareerFixture(2);
  expect(source.career!.history.every((h) => h.coachBook)).toBe(true);
  expect(
    source.career!.history[1].teams.every((t) => t.scoutingSeed?.year === 2),
  ).toBe(true);
  const records = memoryReplayRecords(),
    cache = () =>
      new ReplayCache(
        records.connect(),
        webcrypto as unknown as Crypto,
        "scouting-continuity",
      );
  const restore = (raw: string) =>
    restoreLocalCareerSource(
      raw,
      () => {},
      new AbortController().signal,
      cache(),
    );
  const cold = await restore(JSON.stringify(source));
  const warm = await restore(JSON.stringify(cold.draft));
  expect(warm.replayedYears).toEqual([]);
  expect(warm.draft).toEqual(cold.draft);
  const old = replayLocalHistory(warm.draft, 1);
  const second = replayLocalHistory(warm.draft, 2);
  expect(old.result.league!.teams.every((t) => !t.scoutingSeed)).toBe(true);
  expect(second.result.league!.games[0].scouting!.home.carried).toBe(1);
  const next = startNextLocalSeason(warm.draft);
  expect(localLeagueTeams(next).every((t) => t.scoutingSeed?.year === 3)).toBe(
    true,
  );
  expect(next.career!.history).toEqual(warm.draft.career!.history);
  const changed = structuredClone(warm.draft);
  const seed = changed.career!.history[1].teams[0].scoutingSeed!;
  const entry = Object.values(seed.opponents)[0];
  entry.scouting.possessions += 1;
  await expect(restore(JSON.stringify(changed))).rejects.toThrow();
}, 300000);
