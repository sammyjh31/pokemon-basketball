import { createHash, webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { localCareerFixture } from "./localReplayCache.testUtils";
import { startNextLocalSeason, replayLocalHistory } from "./localCareer";
import { localLeagueTeams } from "./localLeague";
import { restoreLocalCareerSource } from "./localCareerCache";
import { simulateLocalSeason } from "./localSeason";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { coachMoves } from "./movePolicy";
import { exchangePlayers } from "./rosterTrades";
import { simulateMatch } from "./match";
const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
it("restores two new-rule local seasons with identical moves, camp XP and cached history", async () => {
  const draft = localCareerFixture(2),
    source = JSON.stringify(draft);
  const store = memoryReplayRecords(),
    cache = () =>
      new ReplayCache(store.connect(), webcrypto as unknown as Crypto, "moves");
  const cold = await restoreLocalCareerSource(
    source,
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
  expect(
    cold.draft.career!.history.every((h) =>
      h.teams.every((t) => t.movesetVersion === 3),
    ),
  ).toBe(true);
  const history = replayLocalHistory(warm.draft, 1);
  expect(
    history.result.league!.players.some((p) =>
      Object.values(p.abilityActivations?.moves?.uses ?? {}).some(
        (v) => v! > 0,
      ),
    ),
  ).toBe(true);
  const teams = localLeagueTeams(startNextLocalSeason(warm.draft));
  const id = teams[0].roster.PG!,
    outgoing = teams[1].roster.PG!;
  const before = coachMoves(teams[0], id);
  const traded = exchangePlayers(teams, 0, 1, id, outgoing);
  const destination = traded[1];
  expect(coachMoves(destination, id).xp).toBe(before.xp);
  expect(coachMoves(destination, id).moves.length).toBe(before.moves.length);
}, 300000);
it("adopts moves only in the next local season, while the previous archive replays identically", () => {
  const old = localCareerFixture(1, false),
    archived = JSON.stringify(old.career!.history);
  const before = replayLocalHistory(old, 1);
  expect(
    before.result.league!.players.every((p) => !p.abilityActivations?.moves),
  ).toBe(true);
  const next = startNextLocalSeason(old);
  const teams = localLeagueTeams(next);
  expect(teams.every((t) => t.movesetVersion === 4)).toBe(true);
  expect(JSON.stringify(next.career!.history)).toBe(archived);
  expect(sha(replayLocalHistory(next, 1))).toBe(sha(before));
  const match = simulateMatch(teams[0], teams[1], 901);
  expect(match.homeBox.some((p) => p.abilityActivations?.moves)).toBe(true);
}, 300000);
