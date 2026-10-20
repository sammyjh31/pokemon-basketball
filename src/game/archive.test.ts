import { beforeAll, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { createRun, placePokemon } from "./draft";
import * as franchise from "./franchise";
import { simulateSeason } from "./season";
import {
  simulatePlayoffs,
  nextUserPlayoffFixture,
  submitPlayoffGame,
} from "./playoffs";
import {
  advanceFranchiseSeasonAsync,
  nextFranchiseFixture,
} from "./interactiveSeason";
import { officialGameFromArcade } from "./officialGame";
import { finishedGame } from "./officialGame.testUtils";
import { replayArchivedSeason, resolveArchivedMatch } from "./archive";
import {
  loadGame,
  prepareGameLoad,
  saveGame,
  STORAGE_KEY,
} from "./persistence";
import { initialState, gameReducer } from "./state";
import { processOffseason } from "./offseason";
import { validateFranchise } from "./franchiseValidation";
import { ROSTER_SLOTS, type GameState } from "./types";

let finished: GameState;
beforeAll(() => {
  let run = createRun("free", true, 82);
  // Preserve the explicitly historical model-1/2 helper contract.
  delete run.movesetVersion;
  delete run.abilityMasteryVersion;
  delete run.chemistryGrowthVersion;
  delete run.moraleVersion;
  delete run.personalityVersion;
  [129, 150, 149, 68, 143, 9, 94, 59].forEach((id, index) => {
    run = placePokemon(run, id, ROSTER_SLOTS[index]);
  });
  const result = simulateSeason(run);
  finished = {
    ...initialState(82),
    run: {
      ...run,
      result,
      playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
    },
    records: {
      spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
      free: {
        runs: 1,
        bestWins: result.wins,
        perfectSeasons: Number(result.wins === 82),
      },
    },
  };
}, 600000);
function storage(state: GameState) {
  let source = JSON.stringify(state);
  return {
    getItem: () => source,
    setItem: (_key: string, value: string) => {
      source = value;
    },
  };
}

describe("connected franchise archives", () => {
  it("captures frozen replay inputs and totals while retaining legacy helper behavior", () => {
    expect(franchise.archiveFranchiseSeason).toBeTypeOf("function");
    const before = structuredClone(finished);
    const archived = franchise.archiveFranchiseSeason(finished);
    expect(archived.franchise?.modelVersion).toBe(3);
    const replay = archived.franchise!.history[0].replay!;
    expect(replay.regularPlayers).toEqual(finished.run.result!.league!.players);
    expect(replay.playoffPlayers).toEqual(finished.run.playoffs!.players);
    expect(replay.playedGames).toEqual({});
    expect(replay.teams).not.toBe(finished.run.result!.league!.teams);
    expect(() =>
      validateFranchise(archived.franchise, archived.run, true),
    ).not.toThrow();
    const altered = structuredClone(archived);
    const reserve = altered.franchise!.careers.find(
      (p) =>
        p.regular.gamesPlayed > p.regular.gamesStarted + 1 &&
        p.regular.highPoints * (p.regular.gamesPlayed - 1) >= p.regular.points,
    )!;
    expect(reserve).toBeDefined();
    reserve.regular.gamesPlayed--;
    // A plausible DNP is still detectable when exact archive rows exist.
    expect(() =>
      validateFranchise(altered.franchise, altered.run, true),
    ).toThrow();
    replay.teams[0].roster.PG = 1;
    expect(finished).toEqual(before);
    expect(franchise.enterOffseason(finished).franchise!.modelVersion).toBe(1);
  });
  it("restores rich archives and refuses altered frozen totals while preserving source bytes", () => {
    expect(franchise.archiveFranchiseSeason).toBeTypeOf("function");
    const archived = franchise.archiveFranchiseSeason(finished);
    const source = storage(archived);
    expect(saveGame(source, archived).saved).toBe(true);
    const restored = loadGame(source, 99);
    expect(restored.notice).toBeNull();
    expect(restored.state).toEqual(archived);
    archived.franchise!.history[0].replay!.regularPlayers[0].points++;
    const damaged = storage(archived),
      original = damaged.getItem();
    const rejected = loadGame(damaged, 99);
    expect(rejected.preserveSource).toBe(true);
    expect(rejected.state.franchise).toBeUndefined();
    expect(damaged.getItem()).toBe(original);
  }, 600000); // Valid and tampered saves each replay several full seasons.
  it("starts interactive years with empty progress without changing older helper fixtures", () => {
    expect(franchise.startInteractiveFranchiseSeason).toBeTypeOf("function");
    const archived = franchise.archiveFranchiseSeason(finished);
    const next = franchise.startInteractiveFranchiseSeason(archived, 93);
    expect(next.run.seasonProgress).toEqual({
      modelVersion: 1,
      completedRounds: 0,
      playedGames: {},
    });
    expect(next.franchise!.modelVersion).toBe(3);
    const restored = loadGame(storage(next), 99);
    expect(restored.notice).toBeNull();
    expect(restored.state).toEqual(next);
  });
  it("enriches the still-present last year after restoring a legacy offseason save", () => {
    const old = franchise.enterOffseason(finished);
    expect(
      finished.run.result!.league!.players.some((p) => p.gamesPlayed < 82),
    ).toBe(true);
    const restored = loadGame(storage(old), 99);
    expect(restored.notice).toBeNull();
    const next = franchise.startInteractiveFranchiseSeason(restored.state, 94);
    expect(next.franchise!.history[0].replay).toBeDefined();
    expect(next.franchise!.history[0].replay!.regularPlayers).toEqual(
      finished.run.result!.league!.players,
    );
  });
  it("rejects malformed interactive progress instead of silently dropping it", () => {
    const old = franchise.startFranchiseSeason(
      franchise.enterOffseason(finished),
      93,
    );
    const malformed = {
      ...old,
      run: {
        ...old.run,
        seasonProgress: {
          modelVersion: 1 as const,
          completedRounds: -1,
          playedGames: {},
        },
      },
    };
    const source = storage(malformed);
    const loaded = loadGame(source, 99);
    expect(loaded.preserveSource).toBe(true);
    expect(loaded.state.run.id).not.toBe(old.run.id);
    expect(source.getItem()).toContain('"completedRounds":-1');
    expect(STORAGE_KEY).toBe("pokemon-basketball:v3");
  });
});

describe("mixed official season persistence", () => {
  it("restores partial careers, DNPs and official boxes then archives complete regular and playoff overrides", async () => {
    const records = memoryReplayRecords();
    const cache = () =>
      new ReplayCache(
        records.connect(),
        webcrypto as unknown as Crypto,
        "mixed-official",
      );
    const restoreWork: number[] = [];
    const restoreCached = async (state: GameState) => {
      restoreWork.length = 0;
      const prepared = prepareGameLoad(storage(state), 99);
      expect(prepared.restore).toBeTypeOf("function");
      return prepared.restore!(
        (_done, total) => restoreWork.push(total),
        new AbortController().signal,
        cache(),
      );
    };
    const initial = franchise.startInteractiveFranchiseSeason(
      franchise.archiveFranchiseSeason(finished),
      93,
    );
    const fixture = nextFranchiseFixture(initial.run)!,
      teams = initial.run.leagueTeams!;
    const official = officialGameFromArcade(
      finishedGame(fixture, teams),
      fixture,
      teams,
    );
    const run = await advanceFranchiseSeasonAsync(
      initial.run,
      1,
      undefined,
      undefined,
      official,
    );
    const live = { ...initial, run };
    const benchId = run.roster.B3!;
    const bench = franchise
      .careerPlayers(live.franchise!, run)
      .find((player) => player.pokemonId === benchId)!;
    expect(bench.regular.gamesPlayed).toBe(82);
    expect(
      run.seasonProgress!.result!.league!.players.find(
        (player) => player.pokemonId === benchId,
      )!.gamesPlayed,
    ).toBe(0);
    const source = storage(live),
      restored = loadGame(source, 99);
    expect(restored.notice).toBeNull();
    expect(restored.state).toEqual(live);
    const prepared = prepareGameLoad(source, 99);
    expect(prepared.restore).toBeTypeOf("function");
    const hydrated = await prepared.restore!(
      () => {},
      new AbortController().signal,
      cache(),
    );
    expect(hydrated.notice).toBeNull();
    expect(hydrated.state).toEqual(live);
    const corrupt = structuredClone(live);
    corrupt.run.seasonProgress!.result!.wins++;
    expect(loadGame(storage(corrupt), 99).preserveSource).toBe(true);
    const completeRun = await advanceFranchiseSeasonAsync(run, 81);
    const league = completeRun.result!.league!;
    const playoffFixture = nextUserPlayoffFixture(league, run.seasonSeed)!;
    expect(playoffFixture).not.toBeNull();
    const playoffOfficial = officialGameFromArcade(
      finishedGame(playoffFixture, teams),
      playoffFixture,
      teams,
    );
    const partialPlayoffs = submitPlayoffGame(
      league,
      run.seasonSeed,
      undefined,
      playoffOfficial,
    );
    completeRun.playoffs = simulatePlayoffs(
      league,
      run.seasonSeed,
      partialPlayoffs,
    );
    const archived = franchise.archiveFranchiseSeason({
      ...live,
      run: completeRun,
    });
    expect(archived.franchise!.phase).toBe("offseason");
    const last = archived.franchise!.history[1];
    expect(
      last.replay!.regularPlayers.find(
        (player) => player.pokemonId === benchId,
      )!.gamesPlayed,
    ).toBe(81);
    const replay = await replayArchivedSeason(last);
    expect(replay).toEqual(completeRun.result);
    const summary = replay.league!.games.find(
      (game) => game.id === fixture.id,
    )!;
    expect(resolveArchivedMatch(last, summary)).toEqual(official.match);
    const postseason = last
      .replay!.playoffs.series.flatMap((series) => series.games)
      .find((game) => game.id === playoffFixture.id)!;
    expect(resolveArchivedMatch(last, postseason, "playoffs")).toEqual(
      playoffOfficial.match,
    );
    // Verify the new year cold, retaining the genuine evidence earned for
    // year one by the deferred restore above. Official overrides stay exact.
    expect(await restoreCached(archived)).toMatchObject({
      notice: null,
      state: archived,
    });
    expect(restoreWork.some((total) => total > 0)).toBe(true);
    // An earlier discarded year keeps its legacy baseline without inventing rows.
    delete archived.franchise!.history[0].replay;
    expect(await restoreCached(archived)).toMatchObject({
      notice: null,
      state: archived,
    });
    expect(restoreWork.at(-1)).toBe(0);
    expect(last.replay!.teams.every((t) => t.movesetVersion === 4)).toBe(true);
    expect(() =>
      validateFranchise(archived.franchise, archived.run, true),
    ).not.toThrow();
    for (const field of ["uses", "energySpent", "energyRecovered"] as const) {
      const corrupted = structuredClone(archived);
      const row = corrupted.franchise!.careers.find((p) =>
        Object.values(p.regular.abilityActivations?.moves?.uses ?? {}).some(
          (v) => v! > 0,
        ),
      )!;
      const stats = row.regular.abilityActivations!.moves!;
      if (field === "uses") stats.uses.protect = (stats.uses.protect ?? 0) + 1;
      else stats[field]++;
      expect(() =>
        validateFranchise(corrupted.franchise, corrupted.run, true),
      ).toThrow();
    }
    // Even without year one's details, known starts remain a hard lower bound
    // and the unknown year can contribute at most 82. Preserve aggregate starts
    // so these checks cannot pass merely because league-wide totals changed.
    for (const offset of [-1, 83]) {
      const corrupted = structuredClone(archived);
      const capsule = corrupted.franchise!;
      const known = new Map(
        last.replay!.regularPlayers.map((p) => [p.pokemonId, p.gamesStarted]),
      );
      const rows = capsule.careers;
      let changed = false;
      for (const player of rows) {
        const target = known.get(player.pokemonId)! + offset;
        if (target < 0 || target > player.regular.gamesPlayed) continue;
        const delta = target - player.regular.gamesStarted;
        const partner = rows.find(
          (p) =>
            p !== player &&
            p.regular.gamesStarted - delta >= known.get(p.pokemonId)! &&
            p.regular.gamesStarted - delta <= known.get(p.pokemonId)! + 82 &&
            p.regular.gamesStarted - delta <= p.regular.gamesPlayed,
        );
        if (!partner) continue;
        player.regular.gamesStarted = target;
        partner.regular.gamesStarted -= delta;
        changed = true;
        break;
      }
      expect(changed).toBe(true);
      expect(() => validateFranchise(capsule, corrupted.run, true)).toThrow();
    }
  }, 600000);
});

it("retains selected training and validated development after an offseason reload", () => {
  const archived = franchise.archiveFranchiseSeason(finished);
  archived.franchise!.trainingPlans = {
    150: { focus: "shooting", intensity: "aggressive" },
  };
  const developed = processOffseason(archived);
  expect(developed.franchise!.offseasons).toHaveLength(1);
  expect(
    developed
      .franchise!.offseasons![0].players.find(
        (player) => player.pokemonId === 150,
      )!
      .reasons.join(" "),
  ).toMatch(/shooting/i);
  const loaded = loadGame(storage(developed), 99);
  expect(loaded.notice).toBeNull();
  expect(loaded.state.franchise).toEqual(developed.franchise);
  const next = franchise.startInteractiveFranchiseSeason(developed, 13);
  expect(loadGame(storage(next), 99)).toMatchObject({
    notice: null,
    state: next,
  });
  next.franchise!.trainingPlans = {
    [next.franchise!.teams[1].roster.PG!]: {
      focus: "balanced",
      intensity: "steady",
    },
  };
  expect(loadGame(storage(next), 99).preserveSource).toBe(true);
}, 600000);

it("defers rich archive verification before a new year's first fixture and aborts without changing source", async () => {
  const next = franchise.startInteractiveFranchiseSeason(
    franchise.archiveFranchiseSeason(finished),
    93,
  );
  const source = storage(next),
    original = source.getItem();
  const prepared = prepareGameLoad(source, 99);
  expect(prepared.restore).toBeTypeOf("function");
  const controller = new AbortController();
  const progress: number[] = [];
  await expect(
    prepared.restore!((completed, total) => {
      expect(total).toBeGreaterThan(1230);
      progress.push(completed);
      if (completed > 0) controller.abort();
    }, controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(progress.some((completed) => completed > 0)).toBe(true);
  expect(source.getItem()).toBe(original);
}, 600000);

it("rejects corrupted historical inputs after deferred replay instead of trusting structural totals", async () => {
  const next = franchise.startInteractiveFranchiseSeason(
    franchise.archiveFranchiseSeason(finished),
    93,
  );
  // A different seed now invalidates news fixture identities immediately.
  // Change a valid frozen tactic instead, so only actual replay exposes it.
  const team = next.franchise!.history[0].replay!.teams[1];
  team.tactic = team.tactic === "pace" ? "interior" : "pace";
  const source = storage(next),
    original = source.getItem();
  const prepared = prepareGameLoad(source, 99);
  expect(prepared.restore).toBeTypeOf("function");
  const loaded = await prepared.restore!(
    () => {},
    new AbortController().signal,
  );
  expect(loaded.preserveSource).toBe(true);
  expect(loaded.state.franchise).toBeUndefined();
  expect(source.getItem()).toBe(original);
}, 600000);

it("restores an existing franchise waiting for its first coach in year two", async () => {
  const next = gameReducer(franchise.archiveFranchiseSeason(finished), {
    type: "START_FRANCHISE_SEASON",
    seed: 93,
  });
  expect(next.franchise?.year).toBe(2);
  expect(next.run.coachDraftRequired).toBe(true);
  const source = storage(next),
    bytes = source.getItem();
  const prepared = prepareGameLoad(source, 99);
  expect(prepared.notice).toBeNull();
  expect(prepared.restore).toBeTypeOf("function");
  const loaded = await prepared.restore!(
    () => {},
    new AbortController().signal,
  );
  expect(loaded.notice).toBeNull();
  expect(loaded.state.franchise).toEqual(next.franchise);
  expect(loaded.state.run.coachDraftRequired).toBe(true);
  expect(source.getItem()).toBe(bytes);
  await expect(
    advanceFranchiseSeasonAsync(loaded.state.run, 1),
  ).rejects.toThrow(/trainer coach/);
  const chosen = gameReducer(loaded.state, { type: "SELECT_COACH", id: "mom" });
  const played = await advanceFranchiseSeasonAsync(chosen.run, 1);
  expect(played.seasonProgress?.completedRounds).toBe(1);
  expect(played.coach?.id).toBe("mom");
}, 600000);
