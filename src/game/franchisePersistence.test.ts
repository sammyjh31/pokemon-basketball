import { beforeAll, describe, expect, it } from "vitest";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";
import {
  loadGame,
  prepareGameLoad,
  STORAGE_KEY,
  type StorageLike,
} from "./persistence";
import { simulatePlayoffs } from "./playoffs";
import { simulateSeason } from "./season";
import { createRun } from "./draft";
import { teamRatings } from "./ratings";
import { CAREER_KEYS, type CareerTotals } from "./franchiseTypes";
import { enterOffseason, startFranchiseSeason } from "./franchise";

const memory = (value: string): StorageLike => ({
  getItem: () => value,
  setItem: (_key, next) => {
    value = next;
  },
});
let finished: GameState;
let offseason: GameState;
let traded: GameState;
let yearTwo: GameState;
let completedTwo: GameState;
beforeAll(() => {
  let state = initialState(47);
  // These hand-built model-1 capsules predate earned teammate history.
  delete state.run.chemistryGrowthVersion;
  delete state.run.moraleVersion;
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  finished = gameReducer(state, { type: "SIMULATE" });
  const league = finished.run.result!.league!;
  const playoffs = simulatePlayoffs(league, finished.run.seasonSeed);
  const final = playoffs.series[14],
    championId = playoffs.championId!;
  const total = (player?: Partial<CareerTotals>): CareerTotals => {
    const result = {} as CareerTotals;
    for (const key of CAREER_KEYS) result[key] = player?.[key] ?? 0;
    if (player?.abilityActivations)
      result.abilityActivations = structuredClone(player.abilityActivations);
    return result;
  };
  const honor = (playerId: string) => {
    const player = league.players.find(
      (player) => player.playerId === playerId,
    )!;
    return { pokemonId: player.pokemonId, teamId: player.teamId };
  };
  offseason = {
    ...finished,
    run: { ...finished.run, playoffs },
    franchise: {
      modelVersion: 1,
      year: 1,
      phase: "offseason",
      teams: structuredClone(league.teams),
      trades: [],
      careers: league.players
        .map((player) => ({
          pokemonId: player.pokemonId,
          seasons: 1,
          teamIds: [player.teamId],
          regular: total(player),
          playoffs: total(
            playoffs.players.find(
              (entry) => entry.pokemonId === player.pokemonId,
            ),
          ),
        }))
        .sort((a, b) => a.pokemonId - b.pokemonId),
      history: [
        {
          year: 1,
          seasonSeed: finished.run.seasonSeed,
          standings: structuredClone(league.standings),
          rosters: league.teams.map((team) =>
            ROSTER_SLOTS.map((slot) => team.roster[slot]!),
          ),
          awards: league.awards.map(
            ({ id, title, pokemonId, description, value, teamId }) => ({
              id,
              title,
              pokemonId,
              description,
              value,
              teamId,
            }),
          ),
          allLeague: league.allLeague.map(honor),
          allDefense: league.allDefense.map(honor),
          championId,
          runnerUpId: (final.higherSeedId === championId
            ? final.lowerSeedId
            : final.higherSeedId)!,
          runnerUpWins:
            final.higherSeedId === championId
              ? final.lowerSeedWins
              : final.higherSeedWins,
          finalsMvp: structuredClone(playoffs.finalsMvp!),
        },
      ],
    },
  };
  traded = structuredClone(offseason);
  const teams = traded.franchise!.teams,
    giveId = teams[0].roster.PG!,
    receiveId = teams[1].roster.PG!;
  [teams[0].roster.PG, teams[1].roster.PG] = [receiveId, giveId];
  for (const team of teams)
    team.ratings = teamRatings(team.roster, team.tactic, team.rotation);
  traded.franchise!.trades.push({ year: 1, teamId: 1, giveId, receiveId });
  yearTwo = {
    ...traded,
    run: {
      ...createRun("spin", traded.run.includeLegends, 919),
      chemistryGrowthVersion: undefined,
      moraleVersion: undefined,
      roster: { ...teams[0].roster },
      offerIds: [],
      tactic: teams[0].tactic,
      rotation: teams[0].rotation,
      defense: teams[0].defense,
      leagueTeams: structuredClone(teams),
    },
    franchise: { ...traded.franchise!, year: 2, phase: "season" },
  };
  const result = simulateSeason(yearTwo.run);
  completedTwo = {
    ...yearTwo,
    run: {
      ...yearTwo.run,
      result,
      playoffs: simulatePlayoffs(
        result.league!,
        yearTwo.run.seasonSeed,
        undefined,
        "game",
      ),
    },
  };
}, 600000); // Two complete court-model seasons and playoff brackets.

describe("franchise persistence", () => {
  it("preserves malformed franchise history and recovers the verified original season", () => {
    const source = JSON.stringify({
      ...finished,
      franchise: { modelVersion: 99 },
    });
    const storage = memory(source);
    const loaded = loadGame(storage, 999);
    expect(loaded.state).toEqual(finished);
    expect(loaded.notice).toMatch(/franchise/i);
    expect(loaded.preserveSource).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  });

  it("does not silently accept fixed rosters without their franchise capsule", () => {
    const source = JSON.stringify({
      ...finished,
      run: { ...finished.run, leagueTeams: finished.run.result!.league!.teams },
    });
    const loaded = loadGame(memory(source), 999);
    expect(loaded.preserveSource).toBe(true);
    expect(loaded.notice).toMatch(/franchise/i);
  });

  it.each([
    "offseason",
    "traded offseason",
    "second-year pregame",
    "second-year postseason",
  ] as const)(
    "restores %s with species careers and previous-year history intact",
    (phase) => {
      const state =
        phase === "offseason"
          ? offseason
          : phase === "traded offseason"
            ? traded
            : phase === "second-year pregame"
              ? yearTwo
              : completedTwo;
      const loaded = loadGame(memory(JSON.stringify(state)), 999);
      expect(loaded.notice).toBeNull();
      expect(loaded.state).toEqual(state);
      expect(loaded.state.records).toEqual(finished.records);
    },
    60000,
  );

  it("restores an active completed year asynchronously before validating its postseason", async () => {
    const source = JSON.stringify(completedTwo),
      storage = memory(source);
    const prepared = prepareGameLoad(storage, 999);
    expect(prepared.state.run.result).toBeNull();
    expect(prepared.state.franchise).toEqual(yearTwo.franchise);
    expect(prepared.state.run.leagueTeams).toEqual(yearTwo.run.leagueTeams);
    expect(prepared.restore).toBeTypeOf("function");
    const loaded = await prepared.restore!(
      () => {},
      new AbortController().signal,
    );
    expect(loaded.state).toEqual(completedTwo);
    expect(loaded.notice).toBeNull();
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  }, 600000);

  it("defers a completed first-year offseason without prematurely requiring its replayed Finals", async () => {
    const prepared = prepareGameLoad(memory(JSON.stringify(traded)), 999);
    expect(prepared.state.franchise).toEqual(traded.franchise);
    expect(prepared.state.run.result).toBeNull();
    const loaded = await prepared.restore!(
      () => {},
      new AbortController().signal,
    );
    expect(loaded.state).toEqual(traded);
    expect(loaded.notice).toBeNull();
  }, 600000);

  it.each([
    "career points",
    "duplicate career",
    "historical honor",
    "Finals identity",
    "trade identity",
    "duplicate roster",
    "phase",
  ] as const)(
    "preserves an invalid %s franchise rather than silently losing its history",
    (kind) => {
      const corrupted = structuredClone(traded),
        franchise = corrupted.franchise!;
      if (kind === "career points") franchise.careers[0].regular.points += 1;
      if (kind === "duplicate career")
        franchise.careers[0].pokemonId = franchise.careers[1].pokemonId;
      if (kind === "historical honor")
        franchise.history[0].allLeague[0].pokemonId =
          franchise.history[0].rosters[
            (franchise.history[0].allLeague[0].teamId + 1) % 30
          ][0];
      if (kind === "Finals identity")
        franchise.history[0].finalsMvp.playerId = "29:999";
      if (kind === "trade identity")
        franchise.trades[0].giveId = franchise.trades[0].receiveId;
      if (kind === "duplicate roster")
        franchise.teams[1].roster.PG = franchise.teams[0].roster.PG;
      if (kind === "phase") franchise.phase = "season";
      const source = JSON.stringify(corrupted),
        storage = memory(source),
        loaded = loadGame(storage, 999);
      expect(loaded.notice).toMatch(/franchise/i);
      expect(loaded.preserveSource).toBe(true);
      expect(loaded.state.franchise).toBeUndefined();
      expect(loaded.state.run.result).toEqual(finished.run.result);
      expect(storage.getItem(STORAGE_KEY)).toBe(source);
    },
    60000,
  );

  it("keeps a corrupted fixed-roster archive in storage and starts a safe fresh draft", () => {
    const corrupted = structuredClone(completedTwo);
    corrupted.franchise!.careers[0].regular.points += 1;
    const source = JSON.stringify(corrupted),
      storage = memory(source);
    for (const loaded of [
      loadGame(storage, 999),
      prepareGameLoad(storage, 999),
    ]) {
      expect(loaded.state).toEqual(initialState(999));
      expect(loaded.notice).toMatch(/franchise/i);
      expect(loaded.preserveSource).toBe(true);
    }
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  }, 600000);

  it("reconstructs stored ratings from the fixed roster and coaching before play", () => {
    const corrupted = structuredClone(yearTwo);
    corrupted.run.leagueTeams![0].ratings.overall = 999;
    corrupted.franchise!.teams[0].ratings.overall = 999;
    const loaded = loadGame(memory(JSON.stringify(corrupted)), 999);
    expect(loaded.state).toEqual(yearTwo);
    expect(loaded.notice).toBeNull();
  });

  it("restores a second archive and advances through the earlier trade into a third pregame", () => {
    const completed = {
      ...completedTwo,
      run: {
        ...completedTwo.run,
        playoffs: simulatePlayoffs(
          completedTwo.run.result!.league!,
          completedTwo.run.seasonSeed,
        ),
      },
    };
    const secondOffseason = enterOffseason(completed);
    expect(secondOffseason.franchise!.history).toHaveLength(2);
    const third = startFranchiseSeason(secondOffseason, 1001);
    for (const saved of [secondOffseason, third]) {
      const loaded = loadGame(memory(JSON.stringify(saved)), 999);
      expect(loaded.notice).toBeNull();
      expect(loaded.state).toEqual(saved);
    }
    const tradedSpecies = traded.franchise!.trades[0].giveId;
    expect(
      third.franchise!.careers.find(
        (player) => player.pokemonId === tradedSpecies,
      )!.teamIds,
    ).toEqual([0, 1]);
  }, 600000);

  it.each(["games played", "player of game", "unqualified champion"] as const)(
    "cross-checks archived %s after previous game data is discarded",
    (kind) => {
      const corrupted = structuredClone(yearTwo),
        franchise = corrupted.franchise!;
      if (kind === "games played") franchise.careers[0].regular.gamesPlayed--;
      if (kind === "player of game")
        franchise.careers[0].regular.playerOfGame++;
      if (kind === "unqualified champion") {
        const year = franchise.history[0];
        const last = [...year.standings].sort(
          (a, b) =>
            a.wins - b.wins ||
            a.pointsFor - a.pointsAgainst - (b.pointsFor - b.pointsAgainst) ||
            b.teamId - a.teamId,
        )[0].teamId;
        year.championId = last;
        year.finalsMvp.teamId = last;
        year.finalsMvp.pokemonId = year.rosters[last][0];
        year.finalsMvp.playerId = `${last}:${year.finalsMvp.pokemonId}`;
      }
      const loaded = loadGame(memory(JSON.stringify(corrupted)), 999);
      expect(loaded.notice).toMatch(/franchise/i);
      expect(loaded.preserveSource).toBe(true);
    },
  );

  it("rejects postseason totals assigned to a species that never qualified", () => {
    const corrupted = structuredClone(offseason);
    const career = corrupted.franchise!.careers.find(
      (career) => career.playoffs.gamesPlayed === 0,
    )!;
    Object.assign(career.playoffs, {
      gamesPlayed: 1,
      minutes: 1,
      points: 2,
      fgm: 1,
      fga: 1,
      rimFgm: 1,
      rimFga: 1,
      highPoints: 2,
    });
    const loaded = loadGame(memory(JSON.stringify(corrupted)), 999);
    expect(loaded.notice).toMatch(/franchise/i);
    expect(loaded.preserveSource).toBe(true);
  });
});
