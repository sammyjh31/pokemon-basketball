import { describe, expect, it } from "vitest";
import { FRANCHISE_POKEMON } from "../data/pokemon";
import { ROSTER_SLOTS } from "./types";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { localSchedule, simulateLocalSeason } from "./localSeason";
import {
  createPlayoffs,
  playoffGameCount,
  replayPlayoffs,
  simulatePlayoffs,
} from "./playoffs";
import type { LocalLeagueOptions } from "./localFormat";

export const options: LocalLeagueOptions = {
  mode: "generational",
  format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
  engineRules: {
    version: 1,
    abilities: true,
    adaptiveCoaching: true,
    familiarity: 0,
  },
};
const managers = [
  { name: "Sam", teamId: 1 },
  { name: "Alex", teamId: 3 },
];
function drafted(mode: LocalLeagueOptions["mode"] = "generational") {
  let draft = local.createLocalLeague(managers, true, 42, 2, {
    ...options,
    mode,
  });
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const taken = new Set(draft.picks.map((p) => p.pokemonId));
    const mon = local.localLeaguePool(draft).find((p) => !taken.has(p.id))!;
    const occupied = draft.picks
      .filter((p) => p.teamId === turn.teamId)
      .map((p) => p.slot);
    draft = local.pickLocalPlayer(
      draft,
      mon.id,
      ROSTER_SLOTS.find((s) => !occupied.includes(s))!,
    );
  }
  return draft;
}
function finish(mode: LocalLeagueOptions["mode"] = "generational") {
  const draft = drafted(mode),
    result = simulateLocalSeason(draft);
  const playoffs = simulatePlayoffs(
    result.league!,
    career.localSeasonSeed(draft),
  );
  return {
    draft: {
      ...draft,
      completed: true,
      playoffGames: playoffGameCount(playoffs),
    },
    result,
    playoffs,
  };
}
function finishRookies(draft: local.LocalLeague) {
  for (
    let turn = career.currentLocalRookieTurn(draft);
    turn;
    turn = career.currentLocalRookieTurn(draft)
  ) {
    const id = career.localRookiePool(draft)[0].id;
    const release = local.localLeagueTeams(draft)[turn.teamId].roster.PG!;
    draft = career.pickLocalRookie(draft, id, release);
  }
  return draft;
}

describe("configurable local careers", () => {
  it("validates the format and unique manager clubs before drafting a sufficient pool", () => {
    const draft = drafted();
    expect(draft.picks).toHaveLength(32);
    expect(local.localLeaguePool(draft)).toHaveLength(151);
    expect(local.localLeagueTeams(draft)).toHaveLength(4);
    expect(local.localLeaguePool(drafted("full-pool"))).toHaveLength(1025);
    expect(FRANCHISE_POKEMON).toHaveLength(1025);
    for (const invalid of [
      { ...options, format: { ...options.format, teamCount: 30 } },
      { ...options, format: { ...options.format, playoffTeams: 8 } },
      { ...options, format: { ...options.format, gamesPerTeam: 15 } },
    ])
      expect(() =>
        local.createLocalLeague(
          managers,
          true,
          42,
          2,
          invalid as LocalLeagueOptions,
        ),
      ).toThrow();
    expect(() =>
      local.createLocalLeague(
        [
          { name: "a", teamId: 4 },
          { name: "b", teamId: 1 },
        ],
        true,
        42,
        2,
        options,
      ),
    ).toThrow();
  });
  it("balances all supported schedules with an equal home and away count and deterministic seeds", () => {
    for (const teamCount of [4, 8, 16, 30] as const)
      for (const gamesPerTeam of [14, 28, 82] as const) {
        const format = { ...options.format, teamCount, gamesPerTeam };
        const games = localSchedule(format, 17);
        expect(games).toHaveLength((teamCount * gamesPerTeam) / 2);
        expect(new Set(games.map((g) => g.id)).size).toBe(games.length);
        for (let id = 0; id < teamCount; id++) {
          expect(games.filter((g) => g.homeTeamId === id)).toHaveLength(
            gamesPerTeam / 2,
          );
          expect(games.filter((g) => g.awayTeamId === id)).toHaveLength(
            gamesPerTeam / 2,
          );
        }
        expect(games.every((g) => g.homeTeamId !== g.awayTeamId)).toBe(true);
        expect(localSchedule(format, 17)).toEqual(games);
      }
  });
  it("finishes short seasons, awards, and small brackets with an actual finals MVP", () => {
    const { draft, result, playoffs } = finish();
    expect(result.league!.games).toHaveLength(28);
    expect(
      result.league!.standings.every((s) => s.wins + s.losses === 14),
    ).toBe(true);
    expect(result.awards).toHaveLength(6);
    expect(playoffs.series.map((s) => s.round)).toEqual([2, 2, 3]);
    expect(playoffGameCount(playoffs)).toBe(3);
    expect(playoffs.finalsMvp?.teamId).toBe(playoffs.championId);
    expect(
      replayPlayoffs(result.league!, career.localSeasonSeed(draft), 3),
    ).toEqual(playoffs);
    expect(() =>
      replayPlayoffs(result.league!, career.localSeasonSeed(draft), 4),
    ).toThrow();
    expect(() =>
      createPlayoffs(
        {
          ...result.league!,
          standings: result.league!.standings.map((s) => ({ ...s, wins: 0 })),
        },
        1,
      ),
    ).toThrow();
  });
  it("persists two generational seasons without mutating archived inputs or reapplying development", () => {
    const { draft, result, playoffs } = finish();
    expect(() =>
      career.beginLocalOffseason(
        draft,
        result,
        createPlayoffs(result.league!, 42),
      ),
    ).toThrow();
    let offseason = career.beginLocalOffseason(draft, result, playoffs);
    const archived = JSON.stringify(offseason.career!.history[0].teams);
    expect(offseason.career?.history[0].development).toHaveLength(32);
    expect(career.currentLocalRookieTurn(offseason)?.manager).toBeDefined();
    expect(
      career.localRookiePool(offseason).every((p) => p.id > 151 && p.id <= 251),
    ).toBe(true);
    expect(() =>
      career.beginLocalOffseason(offseason, result, playoffs),
    ).toThrow();
    expect(() => career.startNextLocalSeason(offseason)).toThrow();
    offseason = finishRookies(offseason);
    expect(offseason.career!.history[0].rookiePicks).toHaveLength(8);
    expect(JSON.stringify(offseason.career!.history[0].teams)).toBe(archived);
    expect(local.parseLocalLeague(JSON.stringify(offseason))).toEqual(
      offseason,
    );
    const second = career.startNextLocalSeason(offseason);
    expect(second.career?.year).toBe(2);
    expect(second.completed).toBe(false);
    expect(career.currentLocalRookieTurn(second)).toBeNull();
    expect(() => career.startNextLocalSeason(second)).toThrow();
    const result2 = simulateLocalSeason(second),
      playoffs2 = simulatePlayoffs(
        result2.league!,
        career.localSeasonSeed(second),
      );
    const next = career.beginLocalOffseason(
      { ...second, completed: true, playoffGames: playoffGameCount(playoffs2) },
      result2,
      playoffs2,
    );
    expect(
      career.localRookiePool(next).every((p) => p.id > 251 && p.id <= 386),
    ).toBe(true);
    expect(local.parseLocalLeague(JSON.stringify(next))).toEqual(next);
    expect(career.replayLocalHistory(next, 1).result).toEqual(result);
  });
  it("develops full-pool clubs every offseason without any rookie picks and supports agreed player trades", () => {
    const { draft, result, playoffs } = finish("full-pool");
    let offseason = career.beginLocalOffseason(draft, result, playoffs);
    expect(career.currentLocalRookieTurn(offseason)).toBeNull();
    expect(career.localRookiePool(offseason)).toEqual([]);
    expect(() => career.pickLocalRookie(offseason, 152, 1)).toThrow();
    const teams = local.localLeagueTeams(offseason),
      give = teams[1].roster.PG!,
      receive = teams[3].roster.PG!;
    const original = JSON.stringify(offseason.career!.history[0].teams);
    expect(() =>
      career.applyLocalTrade(offseason, 1, 3, give, receive, [1]),
    ).toThrow();
    offseason = career.applyLocalTrade(offseason, 1, 3, give, receive, [1, 3]);
    expect(local.localLeagueTeams(offseason)[3].roster.PG).toBe(give);
    expect(local.localLeagueTeams(offseason)[3].development?.[give]).toEqual(
      teams[1].development?.[give],
    );
    expect(JSON.stringify(offseason.career!.history[0].teams)).toBe(original);
    expect(() =>
      career.applyLocalTrade(offseason, 1, 3, give, receive, [1, 3]),
    ).toThrow();
    expect(local.parseLocalLeague(JSON.stringify(offseason))).toEqual(
      offseason,
    );
    expect(career.startNextLocalSeason(offseason).career?.year).toBe(2);
  });
  it("rejects malformed chronology, unknown rules, duplicate players and altered offseason development", () => {
    const { draft, result, playoffs } = finish("full-pool");
    const valid = career.beginLocalOffseason(draft, result, playoffs);
    const mutate = (fn: (value: typeof valid) => void) => {
      const copy = structuredClone(valid);
      fn(copy);
      return () => local.parseLocalLeague(JSON.stringify(copy));
    };
    expect(mutate((v) => (v.career!.year = 3))).toThrow();
    expect(mutate((v) => (v.career!.history[0].year = 2))).toThrow();
    expect(
      mutate(
        (v) => (v.career!.teams[0].roster.PG = v.career!.teams[1].roster.PG),
      ),
    ).toThrow();
    expect(
      mutate((v) => (v.career!.history[0].development[0].changes.speed = 99)),
    ).toThrow();
    expect(mutate((v) => (v.options!.engineRules.version = 9 as 1))).toThrow();
    expect(
      mutate((v) =>
        v.career!.history[0].rookiePicks.push({
          teamId: 0,
          pokemonId: 1000,
          releasedId: 1,
        }),
      ),
    ).toThrow();
  });
});

describe("local career restore boundaries", () => {
  it("preserves the original unrestricted v2 human-pick acceptance for existing saves", () => {
    const allHuman = Array.from({ length: 30 }, (_, teamId) => ({
      name: `Friend ${teamId}`,
      teamId,
    }));
    const original = local.pickLocalPlayer(
      local.createLocalLeague(allHuman, true, 8, 2),
      1000,
      "PG",
    );
    expect(local.parseLocalLeague(JSON.stringify(original))).toEqual(original);
  });
  it("restores pending rookie turns and a changed lineup/coaching before the next season", () => {
    const { draft, result, playoffs } = finish();
    let pending = career.beginLocalOffseason(draft, result, playoffs);
    expect(local.parseLocalLeague(JSON.stringify(pending))).toEqual(pending);
    expect(simulateLocalSeason(pending)).toEqual(result);
    const turn = career.currentLocalRookieTurn(pending)!,
      id = career.localRookiePool(pending)[0].id,
      release = local.localLeagueTeams(pending)[turn.teamId].roster.PG!;
    pending = career.pickLocalRookie(pending, id, release);
    expect(() => career.pickLocalRookie(pending, id, release)).toThrow();
    pending = finishRookies(pending);
    pending = local.updateLocalCoaching(
      local.swapLocalSlots(pending, 1, "PG", "C"),
      1,
      { tactic: "pace", rotation: "bench", defense: "zone" },
    );
    const teams = local.localLeagueTeams(pending);
    pending = career.applyLocalTrade(
      pending,
      1,
      3,
      teams[1].roster.PG!,
      teams[3].roster.SG!,
      [1, 3],
    );
    expect(local.parseLocalLeague(JSON.stringify(pending))).toEqual(pending);
    const next = career.startNextLocalSeason(pending),
      restored = local.parseLocalLeague(JSON.stringify(next));
    expect(restored).toEqual(next);
    expect(restored.coaching[1]).toEqual({
      tactic: "pace",
      rotation: "bench",
      defense: "zone",
    });
    expect(local.localLeagueTeams(restored)[1].tactic).toBe("pace");
    expect(simulateLocalSeason(restored)).toEqual(simulateLocalSeason(next));
  });
  it("ends new classes after Generation IX while continuing skill development", () => {
    let draft = drafted();
    for (let year = 1; year <= 10; year++) {
      const result = simulateLocalSeason(draft),
        playoffs = simulatePlayoffs(
          result.league!,
          career.localSeasonSeed(draft),
        );
      draft = career.beginLocalOffseason(
        { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
        result,
        playoffs,
      );
      if (year < 9) {
        expect(career.currentLocalRookieTurn(draft)?.generation).toBe(year + 1);
        draft = finishRookies(draft);
      } else {
        expect(career.currentLocalRookieTurn(draft)).toBeNull();
        expect(career.localRookiePool(draft)).toEqual([]);
      }
      expect(draft.career!.history.at(-1)!.development).toHaveLength(32);
      draft = career.startNextLocalSeason(draft);
    }
    expect(local.parseLocalLeague(JSON.stringify(draft))).toEqual(draft);
  }, 20000);
  it("uses each series length and replays a saved prefix without changing the bracket", () => {
    const { result, draft } = finish();
    for (const bestOf of [1, 3, 5, 7] as const) {
      const league = {
          ...result.league!,
          format: { ...options.format, bestOf },
        },
        seed = career.localSeasonSeed(draft);
      const bracket = simulatePlayoffs(league, seed);
      expect(
        bracket.series.every(
          (s) =>
            s.higherSeedWins === Math.ceil(bestOf / 2) ||
            s.lowerSeedWins === Math.ceil(bestOf / 2),
        ),
      ).toBe(true);
      expect(bracket.series.every((s) => s.games.length <= bestOf)).toBe(true);
      const prefix = replayPlayoffs(league, seed, 1);
      expect(simulatePlayoffs(league, seed, prefix)).toEqual(bracket);
    }
  });
});

it("rejects an archived playoff prefix that never completed a championship when replaying history", () => {
  const { draft, result, playoffs } = finish("full-pool");
  const saved = career.beginLocalOffseason(draft, result, playoffs);
  saved.career!.history[0].playoffGames = 1;
  expect(() => career.replayLocalHistory(saved, 1)).toThrow();
});

it("round trips accepted CPU trades after lineup edits and declines unfavorable offers", () => {
  const { draft, result, playoffs } = finish("full-pool");
  const source = career.beginLocalOffseason(draft, result, playoffs);
  const changed = local.updateLocalCoaching(
    local.swapLocalSlots(source, 1, "PG", "C"),
    1,
    { tactic: "pace", rotation: "bench", defense: "zone" },
  );
  const teams = local.localLeagueTeams(changed);
  const offers = Object.values(teams[1].roster).flatMap((give) =>
    Object.values(teams[0].roster).map((receive) => ({
      give: give!,
      receive: receive!,
      evaluation: career.evaluateLocalTrade(changed, 1, 0, give!, receive!),
    })),
  );
  const acceptable = offers.find((o) => o.evaluation.accepted)!;
  const declined = offers.find((o) => !o.evaluation.accepted)!;
  expect(acceptable).toBeDefined();
  expect(declined).toBeDefined();
  expect(() =>
    career.applyLocalTrade(changed, 1, 0, declined.give, declined.receive, [1]),
  ).toThrow();
  const traded = career.applyLocalTrade(
    changed,
    1,
    0,
    acceptable.give,
    acceptable.receive,
    [1],
  );
  expect(local.parseLocalLeague(JSON.stringify(traded))).toEqual(traded);
});

it("gives a best-of-three higher seed home games one and three", () => {
  const { result } = finish();
  const league = {
    ...result.league!,
    format: { ...options.format, bestOf: 3 as const },
  };
  const brackets = Array.from({ length: 20 }, (_, seed) =>
    simulatePlayoffs(league, seed),
  );
  expect(brackets.some((b) => b.series.some((s) => s.games.length === 3))).toBe(
    true,
  );
  for (const bracket of brackets)
    for (const series of bracket.series) {
      expect(series.games[0].homeTeamId).toBe(series.higherSeedId);
      expect(series.games[1].homeTeamId).toBe(series.lowerSeedId);
      if (series.games[2])
        expect(series.games[2].homeTeamId).toBe(series.higherSeedId);
    }
});

it("supports cancellable season and archive replays with matching results", async () => {
  const { draft, result, playoffs } = finish("full-pool");
  const offseason = career.beginLocalOffseason(draft, result, playoffs);
  const restored = await career.replayLocalHistoryAsync(offseason, 1);
  expect(restored).toEqual({ result, playoffs });
  const controller = new AbortController();
  await expect(
    career.replayLocalHistoryAsync(
      offseason,
      1,
      () => controller.abort(),
      controller.signal,
    ),
  ).rejects.toThrow();
  const { simulateLocalSeasonAsync } = await import("./localSeason");
  await expect(
    simulateLocalSeasonAsync(draft, () => {}, controller.signal),
  ).rejects.toThrow();
});

it("preserves unique players while filling the largest pool and excludes banned legends", () => {
  const managers = Array.from({ length: 30 }, (_, teamId) => ({
    name: `Friend ${teamId}`,
    teamId,
  }));
  let draft = local.createLocalLeague(managers, false, 17, 2, {
    ...options,
    mode: "full-pool",
    format: { teamCount: 30, gamesPerTeam: 82, playoffTeams: 16, bestOf: 7 },
  });
  const pool = FRANCHISE_POKEMON.filter((p) => !p.legendary);
  for (let i = 0; i < 240; i++)
    draft = local.pickLocalPlayer(
      draft,
      pool[i].id,
      ROSTER_SLOTS[Math.floor(i / 30)],
    );
  expect(
    new Set(
      local.localLeagueTeams(draft).flatMap((t) => Object.values(t.roster)),
    ).size,
  ).toBe(240);
  expect(local.parseLocalLeague(JSON.stringify(draft))).toEqual(draft);
  expect(
    local
      .localLeagueTeams(draft)
      .every((t) => t.engineRules?.adaptiveCoaching === false),
  ).toBe(true);
});

it("rejects invented or repeated manager approvals instead of cleaning them out of a saved trade", () => {
  const { draft, result, playoffs } = finish("full-pool");
  const source = career.beginLocalOffseason(draft, result, playoffs),
    teams = local.localLeagueTeams(source),
    give = teams[1].roster.PG!,
    receive = teams[3].roster.PG!;
  expect(() =>
    career.applyLocalTrade(source, 1, 3, give, receive, [1, 3, 99]),
  ).toThrow();
  expect(() =>
    career.applyLocalTrade(source, 1, 3, give, receive, [1, 3, 3]),
  ).toThrow();
});
