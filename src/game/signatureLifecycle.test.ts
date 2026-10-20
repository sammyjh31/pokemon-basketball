import { createHash, webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { localCareerFixture } from "./localReplayCache.testUtils";
import { startNextLocalSeason, replayLocalHistory } from "./localCareer";
import { localLeagueTeams } from "./localLeague";
import { restoreLocalCareerSource } from "./localCareerCache";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { exchangePlayers } from "./rosterTrades";
const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
it("replays mixed v1/v2 local seasons exactly, retains mastery through trades and skips verified warm history", async () => {
  const draft = localCareerFixture(2, 1, 2);
  expect(draft.career!.history.map((h) => h.teams[0].movesetVersion)).toEqual([
    1, 2,
  ]);
  const old = replayLocalHistory(draft, 1);
  expect(
    old.result.league!.players.every(
      (p) => !p.abilityActivations?.moves?.combos,
    ),
  ).toBe(true);
  const store = memoryReplayRecords();
  const cache = () =>
    new ReplayCache(
      store.connect(),
      webcrypto as unknown as Crypto,
      "signature",
    );
  const cold = await restoreLocalCareerSource(
    JSON.stringify(draft),
    () => {},
    new AbortController().signal,
    cache(),
  );
  const warm = await restoreLocalCareerSource(
    JSON.stringify(cold.draft),
    () => {},
    new AbortController().signal,
    cache(),
  );
  expect(sha(warm.draft)).toBe(sha(cold.draft));
  expect(warm.replayedYears).toEqual([]);
  expect(replayLocalHistory(warm.draft, 1)).toEqual(old);
  const teams = localLeagueTeams(startNextLocalSeason(warm.draft));
  const id = teams[0].roster.PG!,
    outgoing = teams[1].roster.PG!;
  const xp = teams[0].abilityMastery![id];
  const exchanged = exchangePlayers(teams, 0, 1, id, outgoing);
  expect(exchanged[1].abilityMastery![id]).toBe(xp);
  expect(exchanged[0].abilityMastery![id]).toBeUndefined();
}, 300000);
