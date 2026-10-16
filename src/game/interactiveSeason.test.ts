import { describe, expect, it } from "vitest";
import {
  nextFranchiseFixture,
  advanceFranchiseSeasonAsync,
  replaySeasonProgress,
} from "./interactiveSeason";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade } from "./officialGame";
import { simulateSeason, seasonTeams } from "./season";

describe("interactive franchise progress", () => {
  it("records one played fixture with the entire league round and derives appearances once", async () => {
    const { run, teams } = officialFixture();
    const fixture = nextFranchiseFixture(run)!;
    const game = officialGameFromArcade(
      finishedGame(fixture, teams),
      fixture,
      teams,
    );
    const next = await advanceFranchiseSeasonAsync(
      run,
      1,
      undefined,
      undefined,
      game,
    );
    expect(next.result).toBeNull();
    expect(next.seasonProgress!.completedRounds).toBe(1);
    expect(next.seasonProgress!.result!.league!.games).toHaveLength(15);
    expect(next.seasonProgress!.result!.awards).toEqual([]);
    const players = next.seasonProgress!.result!.league!.players.filter(
      (p) => p.teamId === 0,
    );
    expect(
      players
        .slice(0, 5)
        .every((p) => p.gamesPlayed === 1 && p.gamesStarted === 1),
    ).toBe(true);
    expect(players.slice(5).every((p) => p.gamesPlayed === 0)).toBe(true);
    expect(Object.keys(next.seasonProgress!.playedGames)).toEqual([fixture.id]);
    await expect(
      advanceFranchiseSeasonAsync(next, 1, undefined, undefined, game),
    ).rejects.toThrow();
    expect(
      replaySeasonProgress(next, 1, next.seasonProgress!.playedGames),
    ).toEqual(next.seasonProgress!.result);
  });
  it("mixes played and simulated rounds, freezes inputs, and preserves official boxes through completion", async () => {
    const { run, teams } = officialFixture();
    const first = nextFranchiseFixture(run)!;
    const game = officialGameFromArcade(
      finishedGame(first, teams),
      first,
      teams,
    );
    const partial = await advanceFranchiseSeasonAsync(
      run,
      1,
      undefined,
      undefined,
      game,
    );
    const changed = {
      ...partial,
      tactic: "pace" as const,
      roster: {
        ...partial.roster,
        PG: partial.roster.B1,
        B1: partial.roster.PG,
      },
    };
    expect(seasonTeams(changed)).toEqual(seasonTeams(partial));
    const complete = await advanceFranchiseSeasonAsync(partial, 81);
    expect(complete.result!.modelVersion).toBe(6);
    expect(complete.result!.games).toHaveLength(82);
    expect(complete.seasonProgress!.result).toBeUndefined();
    expect(
      complete.result!.league!.games.find((g) => g.id === first.id)!.homeScore,
    ).toBe(game.match.homeScore);
    expect(simulateSeason(partial)).toEqual(complete.result);
    expect(nextFranchiseFixture(complete)).toBeNull();
  }, 20000);
  it("rejects a stored official result ahead of the current prefix", async () => {
    const { run, teams } = officialFixture();
    const first = nextFranchiseFixture(run)!;
    const game = officialGameFromArcade(
      finishedGame(first, teams),
      first,
      teams,
    );
    await expect(
      advanceFranchiseSeasonAsync(
        {
          ...run,
          seasonProgress: {
            modelVersion: 1,
            completedRounds: 0,
            playedGames: { [first.id]: game },
          },
        },
        1,
      ),
    ).rejects.toThrow();
  });
  it("rejects malformed prefixes, future overrides and cancellation without mutation", async () => {
    const { run, teams } = officialFixture();
    const before = structuredClone(run);
    expect(() => replaySeasonProgress(run, 83, {})).toThrow();
    const first = nextFranchiseFixture(run)!;
    const game = officialGameFromArcade(
      finishedGame(first, teams),
      first,
      teams,
    );
    expect(() => replaySeasonProgress(run, 0, { [first.id]: game })).toThrow();
    const controller = new AbortController();
    controller.abort();
    await expect(
      advanceFranchiseSeasonAsync(run, 1, undefined, controller.signal),
    ).rejects.toThrow();
    expect(run).toEqual(before);
  });
});
