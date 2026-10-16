import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { initialState } from "../game/state";
import { officialFixture, finishedGame } from "../game/officialGame.testUtils";
import { nextFranchiseFixture } from "../game/interactiveSeason";
import { nextUserPlayoffFixture, playoffGameCount } from "../game/playoffs";
import { officialGameFromArcade } from "../game/officialGame";
import type { GameState, LeagueResult } from "../game/types";
import { useGame } from "./useGame";

const storage = { getItem: () => null, setItem: () => {} };
function franchiseState(): GameState {
  const { run, teams } = officialFixture();
  return {
    ...initialState(340),
    run,
    franchise: {
      modelVersion: 3,
      year: 2,
      phase: "season",
      teams,
      careers: [],
      history: [],
      trades: [],
    },
  };
}
function playoffState(): GameState {
  const state = franchiseState(),
    teams = state.run.leagueTeams!;
  const league: LeagueResult = {
    teams,
    games: [],
    players: [],
    awards: [],
    allLeague: [],
    allDefense: [],
    standings: teams.map((t) => ({
      teamId: t.id,
      wins: 60 - t.id,
      losses: 22 + t.id,
      pointsFor: 9000,
      pointsAgainst: 8500,
      homeWins: 30,
      awayWins: 30 - t.id,
      streak: 1,
      lastTen: 5,
    })),
  };
  return {
    ...state,
    run: {
      ...state.run,
      result: {
        modelVersion: 6,
        games: [],
        wins: 60,
        losses: 22,
        mvpId: 65,
        league,
      },
    },
  };
}

describe("official game hook acceptance", () => {
  it("rejects a retained regular-season callback after the active run changes", async () => {
    const state = franchiseState(),
      source = state.run,
      fixture = nextFranchiseFixture(source)!;
    const game = officialGameFromArcade(
      finishedGame(fixture, source.leagueTeams!),
      fixture,
      source.leagueTeams!,
    );
    const { result } = renderHook(() => useGame(state, storage));
    const retained = result.current.advanceSeason;
    act(() => result.current.dispatch({ type: "TACTIC", tactic: "pace" }));
    await expect(retained(1, game, source)).rejects.toThrow(
      /no longer matches/,
    );
    expect(result.current.state.run.seasonProgress).toBeUndefined();
    expect(result.current.state.run.tactic).toBe("pace");
  });
  it("accepts an in-flight regular game once and rejects both concurrent and retained duplicate callbacks", async () => {
    const state = franchiseState(),
      source = state.run,
      fixture = nextFranchiseFixture(source)!;
    const game = officialGameFromArcade(
      finishedGame(fixture, source.leagueTeams!),
      fixture,
      source.leagueTeams!,
    );
    const { result } = renderHook(() => useGame(state, storage));
    const retained = result.current.advanceSeason;
    let outcomes: PromiseSettledResult<void>[] = [];
    await act(async () => {
      outcomes = await Promise.allSettled([
        retained(1, game, source),
        retained(1, game, source),
      ]);
    });
    expect(outcomes.map((o) => o.status)).toEqual(["fulfilled", "rejected"]);
    const accepted = result.current.state.run;
    expect(accepted.seasonProgress!.completedRounds).toBe(1);
    expect(Object.keys(accepted.seasonProgress!.playedGames)).toHaveLength(1);
    expect(
      accepted.seasonProgress!.result!.league!.players.find(
        (p) => p.playerId === game.match.playerOfGameId,
      )!.playerOfGame,
    ).toBe(1);
    await expect(retained(1, game, source)).rejects.toThrow(
      /no longer matches/,
    );
    expect(result.current.state.run).toBe(accepted);
  });
  it("accepts same-tick playoff submissions only once and rejects a retained old source", async () => {
    const state = playoffState(),
      source = state.run,
      league = source.result!.league!;
    const fixture = nextUserPlayoffFixture(league, source.seasonSeed)!;
    const game = officialGameFromArcade(
      finishedGame(fixture, league.teams),
      fixture,
      league.teams,
    );
    const { result } = renderHook(() => useGame(state, storage));
    const retained = result.current.recordPlayoffGame;
    let outcomes: PromiseSettledResult<void>[] = [];
    await act(async () => {
      outcomes = await Promise.allSettled([
        retained(game, source),
        retained(game, source),
      ]);
    });
    expect(outcomes.map((o) => o.status)).toEqual(["fulfilled", "rejected"]);
    const accepted = result.current.state.run;
    expect(playoffGameCount(accepted.playoffs!)).toBe(1);
    expect(Object.keys(accepted.playoffs!.playedGames!)).toEqual([fixture.id]);
    await expect(retained(game, source)).rejects.toThrow(/no longer matches/);
    expect(result.current.state.run).toBe(accepted);
  });
});
