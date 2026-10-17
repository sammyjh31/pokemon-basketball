import { beforeAll, describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "./draft";
import { enterOffseason, startFranchiseSeason } from "./franchise";
import { validateLeagueTeams } from "./franchiseValidation";
import {
  loadGame,
  prepareGameLoad,
  STORAGE_KEY,
  type StorageLike,
} from "./persistence";
import { simulatePlayoffs } from "./playoffs";
import { positionRating, teamRatings } from "./ratings";
import { simulateSeason } from "./season";
import { gameReducer, initialState } from "./state";
import { POSITIONS, ROSTER_SLOTS, type GameState } from "./types";
import type { DevelopmentRatings } from "./developmentTypes";

const memory = (value: string): StorageLike => ({
  getItem: () => value,
  setItem: (_key, next) => {
    value = next;
  },
});
const best = (id: number, changes?: DevelopmentRatings) =>
  Math.round(
    Math.max(
      ...POSITIONS.map((position) =>
        positionRating(POKEMON_BY_ID.get(id)!, position, changes),
      ),
    ) * 10,
  ) / 10;
let legacy: GameState;
let processed: GameState;
let next: GameState;
let legacyTwo: GameState;
beforeAll(() => {
  let state = initialState(51);
  // These hand-built model-2 capsules predate earned teammate history.
  delete state.run.chemistryGrowthVersion;
  for (const position of ROSTER_SLOTS)
    state = gameReducer(state, {
      type: "PLACE",
      position,
      pokemonId: state.run.offerIds[0],
    });
  const result = simulateSeason(state.run);
  state = {
    ...state,
    records: {
      ...state.records,
      spin: {
        runs: 1,
        bestWins: result.wins,
        perfectSeasons: Number(result.wins === 82),
      },
    },
    run: {
      ...state.run,
      result,
      playoffs: simulatePlayoffs(result.league!, state.run.seasonSeed),
    },
  };
  legacy = enterOffseason(state);
  legacyTwo = startFranchiseSeason(legacy, 91);
  processed = structuredClone(legacy);
  const franchise = processed.franchise!;
  franchise.modelVersion = 2;
  franchise.offseasons = [
    {
      modelVersion: 1,
      year: 1,
      tradeStart: 0,
      tradeCount: 1,
      players: result.league!.players.map((player) => {
        const changes: DevelopmentRatings = {
          finishing: player.pokemonId % 2 ? 3 : -2,
        };
        return {
          pokemonId: player.pokemonId,
          teamId: player.teamId,
          before: best(player.pokemonId),
          after: best(player.pokemonId, changes),
          minutesPerGame: player.minutes / player.gamesPlayed,
          impactPer36: 7,
          changes,
          outcome: "growth",
          reasons: ["Season form"],
        };
      }),
    },
  ];
  for (const team of franchise.teams) {
    team.development = Object.fromEntries(
      Object.values(team.roster).map((id) => [
        id,
        { finishing: id! % 2 ? 3 : -2 },
      ]),
    );
    team.ratings = teamRatings(
      team.roster,
      team.tactic,
      team.rotation,
      team.development,
    );
  }
  const a = franchise.teams[1],
    b = franchise.teams[2],
    giveId = a.roster.PG!,
    receiveId = b.roster.PG!;
  [a.roster.PG, b.roster.PG] = [receiveId, giveId];
  const give = a.development![giveId]!,
    receive = b.development![receiveId]!;
  delete a.development![giveId];
  delete b.development![receiveId];
  a.development![receiveId] = receive;
  b.development![giveId] = give;
  a.ratings = teamRatings(a.roster, a.tactic, a.rotation, a.development);
  b.ratings = teamRatings(b.roster, b.tactic, b.rotation, b.development);
  franchise.trades.push({
    year: 1,
    fromTeamId: 1,
    teamId: 2,
    giveId,
    receiveId,
    source: "cpu",
    reason: "Both rotations improve.",
  });
  const teams = structuredClone(franchise.teams),
    user = teams[0];
  next = {
    ...processed,
    run: {
      ...createRun("spin", true, 67),
      chemistryGrowthVersion: undefined,
      includeLegends: processed.run.includeLegends,
      roster: { ...user.roster },
      offerIds: [],
      tactic: user.tactic,
      rotation: user.rotation,
      defense: user.defense,
      leagueTeams: teams,
    },
    franchise: { ...franchise, phase: "season", year: 2 },
  };
}, 600000);

describe("development save validation", () => {
  it("restores a processed model-3 offseason without rewriting its season", () => {
    const loaded = loadGame(memory(JSON.stringify(processed)), 999);
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(processed);
    expect(loaded.state.run.result!.modelVersion).toBe(3);
  }, 600000);
  it("round trips developed pregame teams and rebuilds cached ratings", () => {
    const source = structuredClone(next);
    source.franchise!.teams[1].ratings.overall = 999;
    source.run.leagueTeams![1].ratings.overall = 999;
    const loaded = loadGame(memory(JSON.stringify(source)), 999);
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(next);
  });
  it("replays a developed season and playoffs asynchronously", async () => {
    const result = simulateSeason(next.run);
    expect(result.modelVersion).toBe(5);
    const completed = {
      ...next,
      run: {
        ...next.run,
        result,
        playoffs: simulatePlayoffs(
          result.league!,
          next.run.seasonSeed,
          undefined,
          "game",
        ),
      },
    };
    const prepared = prepareGameLoad(memory(JSON.stringify(completed)), 999);
    expect(prepared.restore).toBeTypeOf("function");
    const loaded = await prepared.restore!(
      () => {},
      new AbortController().signal,
    );
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(completed);
  }, 600000); // Full season generation plus deferred replay.
  it("honors user trades before and after the CPU report range", () => {
    const state = structuredClone(next),
      franchise = state.franchise!;
    const swap = (teamId: number) => {
      const user = franchise.teams[0],
        partner = franchise.teams[teamId],
        giveId = user.roster.PG!,
        receiveId = partner.roster.PG!;
      [user.roster.PG, partner.roster.PG] = [receiveId, giveId];
      const give = user.development![giveId]!,
        receive = partner.development![receiveId]!;
      delete user.development![giveId];
      delete partner.development![receiveId];
      user.development![receiveId] = receive;
      partner.development![giveId] = give;
      return { year: 1, teamId, giveId, receiveId };
    };
    franchise.trades.unshift(swap(3));
    franchise.offseasons![0].tradeStart = 1;
    franchise.trades.push(swap(4));
    for (const team of franchise.teams)
      team.ratings = teamRatings(
        team.roster,
        team.tactic,
        team.rotation,
        team.development,
      );
    state.run.leagueTeams = structuredClone(franchise.teams);
    state.run.roster = { ...franchise.teams[0].roster };
    expect(loadGame(memory(JSON.stringify(state)), 999).state).toEqual(state);
  });
  it("processes an old model-4 offseason without applying growth to its frozen replay", () => {
    const result = simulateSeason(legacyTwo.run),
      completed = {
        ...legacyTwo,
        run: {
          ...legacyTwo.run,
          result,
          playoffs: simulatePlayoffs(result.league!, legacyTwo.run.seasonSeed),
        },
      };
    const state = enterOffseason(completed),
      franchise = state.franchise!;
    expect(franchise.history).toHaveLength(2);
    franchise.modelVersion = 2;
    franchise.offseasons = [
      {
        modelVersion: 1,
        year: 2,
        tradeStart: 0,
        tradeCount: 0,
        players: result.league!.players.map((player) => {
          const changes: DevelopmentRatings = { finishing: 2 };
          return {
            pokemonId: player.pokemonId,
            teamId: player.teamId,
            before: best(player.pokemonId),
            after: best(player.pokemonId, changes),
            minutesPerGame: player.minutes / 82,
            impactPer36: 0,
            changes,
            outcome: "growth",
            reasons: ["A strong season"],
          };
        }),
      },
    ];
    for (const team of franchise.teams) {
      team.development = Object.fromEntries(
        Object.values(team.roster).map((id) => [id, { finishing: 2 }]),
      );
      team.ratings = teamRatings(
        team.roster,
        team.tactic,
        team.rotation,
        team.development,
      );
    }
    const loaded = loadGame(memory(JSON.stringify(state)), 999);
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(state);
    expect(loaded.state.run.result!.modelVersion).toBe(4);
    expect(
      loaded.state.run.leagueTeams!.every((team) => !team.development),
    ).toBe(true);
  }, 600000);
  it("continues to load an unprocessed model-4 season", () => {
    const result = simulateSeason(legacyTwo.run);
    expect(result.modelVersion).toBe(4);
    const completed = { ...legacyTwo, run: { ...legacyTwo.run, result } };
    expect(loadGame(memory(JSON.stringify(completed)), 999).state).toEqual(
      completed,
    );
  }, 600000); // Full season generation plus persistence replay.
  it.each([
    "unknown skill",
    "fraction",
    "cumulative bound",
    "wrong owner",
    "missing player",
    "partial teams",
  ])("preserves source for %s offsets", (kind) => {
    const corrupted = structuredClone(next),
      teams = corrupted.franchise!.teams,
      id = teams[0].roster.PG!;
    if (kind === "unknown skill")
      Object.assign(teams[0].development![id]!, { shooting: 2 });
    if (kind === "fraction") teams[0].development![id]!.finishing = 1.5;
    if (kind === "cumulative bound") teams[0].development![id]!.finishing = 31;
    if (kind === "wrong owner") teams[0].development![teams[1].roster.PG!] = {};
    if (kind === "missing player") delete teams[0].development![id];
    if (kind === "partial teams") delete teams[0].development;
    const source = JSON.stringify(corrupted),
      storage = memory(source),
      loaded = loadGame(storage, 999);
    expect(loaded.preserveSource).toBe(true);
    expect(loaded.state.franchise).toBeUndefined();
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  });
  it.each([
    "duplicate player",
    "duplicate year",
    "future year",
    "annual bound",
    "wrong club",
    "unaccounted offsets",
    "CPU owner",
    "CPU range",
    "CPU user",
    "legacy metadata",
  ])("rejects %s corruption", (kind) => {
    const corrupted = structuredClone(next),
      franchise = corrupted.franchise!,
      report = franchise.offseasons![0];
    if (kind === "duplicate player")
      report.players[0] = structuredClone(report.players[1]);
    if (kind === "duplicate year")
      franchise.offseasons!.push(structuredClone(report));
    if (kind === "future year") report.year = 1001;
    if (kind === "annual bound") report.players[0].changes.finishing = 13;
    if (kind === "wrong club")
      report.players[0].teamId = (report.players[0].teamId + 1) % 30;
    if (kind === "unaccounted offsets")
      franchise.teams[0].development![franchise.teams[0].roster.PG!]!
        .finishing!++;
    if (kind === "CPU owner")
      franchise.trades[0].giveId = franchise.trades[0].receiveId;
    if (kind === "CPU range") report.tradeCount = 0;
    if (kind === "CPU user") franchise.trades[0].fromTeamId = 0;
    if (kind === "legacy metadata") {
      franchise.modelVersion = 1;
      delete franchise.offseasons;
    }
    const source = JSON.stringify(corrupted),
      storage = memory(source),
      loaded = loadGame(storage, 999);
    expect(loaded.preserveSource).toBe(true);
    expect(loaded.state.franchise).toBeUndefined();
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  });
  it("rejects development maps on legacy model-1 capsules", () => {
    const corrupted = structuredClone(legacyTwo);
    for (const team of corrupted.franchise!.teams)
      team.development = Object.fromEntries(
        Object.values(team.roster).map((id) => [id, {}]),
      );
    expect(
      loadGame(memory(JSON.stringify(corrupted)), 999).preserveSource,
    ).toBe(true);
  });
  it("rejects a frozen season snapshot whose development differs from its reports", () => {
    const corrupted = structuredClone(next),
      team = corrupted.run.leagueTeams![0];
    team.development![team.roster.PG!]!.finishing!++;
    const source = JSON.stringify(corrupted),
      storage = memory(source);
    for (const loaded of [
      loadGame(storage, 999),
      prepareGameLoad(storage, 999),
    ]) {
      expect(loaded.preserveSource).toBe(true);
      expect(loaded.state.franchise).toBeUndefined();
    }
    expect(storage.getItem(STORAGE_KEY)).toBe(source);
  });
  it("does not silently discard unknown keys during team reconstruction", () => {
    const teams = structuredClone(next.run.leagueTeams!);
    Object.assign(teams[0].development![teams[0].roster.PG!]!, { unknown: 5 });
    expect(() => validateLeagueTeams(teams, next.run.includeLegends)).toThrow();
  });
});
