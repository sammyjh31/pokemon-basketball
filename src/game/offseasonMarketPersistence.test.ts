import { beforeAll, describe, it, expect } from "vitest";
import { createRun } from "./draft";
import { ROSTER_SLOTS, type GameState } from "./types";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import {
  archiveFranchiseSeason,
  startInteractiveFranchiseSeason,
} from "./franchise";
import { processOffseason } from "./offseason";
import { suggestTrades } from "./tradeMarket";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import { loadGame } from "./persistence";
let offseason: GameState;
beforeAll(() => {
  const run = {
    ...createRun("free", true, 47),
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
    ) as GameState["run"]["roster"],
  };
  const result = simulateSeason(run);
  offseason = processOffseason(
    archiveFranchiseSeason({
      ...initialState(47),
      records: {
        ...initialState(47).records,
        free: {
          runs: 1,
          bestWins: result.wins,
          perfectSeasons: Number(result.wins === 82),
        },
      },
      run: {
        ...run,
        result,
        playoffs: simulatePlayoffs(result.league!, run.seasonSeed),
      },
    }),
  );
}, 30000);
const restore = (s: GameState) =>
  loadGame({ getItem: () => JSON.stringify(s), setItem: () => {} }, 1).state;
const reject = (s: GameState) =>
  expect(
    loadGame({ getItem: () => JSON.stringify(s), setItem: () => {} }, 1)
      .preserveSource,
  ).toBe(true);
function completeDraft(state: GameState) {
  let next = beginRookieDraft(state);
  for (let i = 0; i < 2; i++) {
    if (next.franchise!.rookieDrafts!.at(-1)!.complete) break;
    const choice = recommendedRookiePick(
      next.franchise!,
      0,
      next.run.includeLegends,
    )!;
    next = selectRookie(next, choice.pokemonId, choice.releasedId);
  }
  return next;
}
describe("package and rookie franchise persistence", () => {
  it("executes a two-player offer atomically, preserves training ownership and restores every member", () => {
    const suggestion = suggestTrades(offseason.franchise!, {
      packageSize: 2,
      limit: 1,
    })[0];
    expect(suggestion).toBeDefined();
    const offer = suggestion.offer;
    const state = {
      ...offseason,
      franchise: {
        ...offseason.franchise!,
        trainingPlans: Object.fromEntries(
          offer.giveIds.map((id) => [
            id,
            { focus: "shooting" as const, intensity: "standard" as const },
          ]),
        ),
      },
    };
    const next = gameReducer(state, { type: "TRADE_PACKAGE", offer } as never);
    expect(next).not.toBe(state);
    expect(next.run).toBe(state.run);
    expect(next.franchise!.history).toBe(state.franchise!.history);
    expect(next.franchise!.trades).toHaveLength(
      state.franchise!.trades.length + 1,
    );
    expect(next.franchise!.trades.at(-1)).toMatchObject({
      giveIds: offer.giveIds,
      receiveIds: offer.receiveIds,
      packageVersion: 1,
    });
    for (const id of offer.giveIds) {
      expect(Object.values(next.franchise!.teams[0].roster)).not.toContain(id);
      expect(next.franchise!.trainingPlans?.[id]).toBeUndefined();
    }
    for (const id of offer.receiveIds)
      expect(Object.values(next.franchise!.teams[0].roster)).toContain(id);
    expect(gameReducer(next, { type: "TRADE_PACKAGE", offer } as never)).toBe(
      next,
    );
    expect(restore(next).franchise).toEqual(next.franchise);
    const corrupt = structuredClone(next);
    corrupt.franchise!.trades.at(-1)!.giveIds![1] = offer.giveIds[0];
    reject(corrupt);
    const mismatched = structuredClone(next);
    mismatched.franchise!.trades.at(-1)!.giveId = 999;
    reject(mismatched);
    // Validates the complete new-model season for three separate saves.
  }, 90000);
  it("restores a partial draft, rejects forged picks, then keeps released careers across a rookie season", () => {
    const partial = beginRookieDraft(offseason);
    expect(partial.franchise!.rookieDrafts?.at(-1)?.complete).toBe(false);
    expect(restore(partial).franchise).toEqual(partial.franchise);
    expect(
      gameReducer(partial, { type: "START_FRANCHISE_SEASON", seed: 2 }),
    ).toBe(partial);
    const drafted = completeDraft(offseason),
      draft = drafted.franchise!.rookieDrafts!.at(-1)!;
    expect(draft.picks).toHaveLength(60);
    expect(draft.complete).toBe(true);
    expect(
      new Set(drafted.franchise!.teams.flatMap((t) => Object.values(t.roster)))
        .size,
    ).toBe(240);
    expect(restore(drafted).franchise).toEqual(drafted.franchise);
    for (const corruptDraft of [
      (d: typeof draft) => {
        d.generation = 4;
      },
      (d: typeof draft) => {
        [d.order[0], d.order[1]] = [d.order[1], d.order[0]];
      },
      (d: typeof draft) => {
        d.picks[0].round = 2;
      },
      (d: typeof draft) => {
        d.picks[1].pokemonId = d.picks[0].pokemonId;
      },
      (d: typeof draft) => {
        d.picks.pop();
        d.exhausted = true;
      },
    ]) {
      const bad = structuredClone(drafted);
      corruptDraft(bad.franchise!.rookieDrafts![0]);
      reject(bad);
    }
    const falseComplete = structuredClone(partial);
    falseComplete.franchise!.rookieDrafts![0].complete = true;
    falseComplete.franchise!.rookieDrafts![0].exhausted = true;
    reject(falseComplete);
    const afterPartial = structuredClone(partial);
    afterPartial.franchise!.trades.push({
      year: 1,
      teamId: 1,
      giveId: afterPartial.franchise!.teams[0].roster.PG!,
      receiveId: afterPartial.franchise!.teams[1].roster.PG!,
    });
    reject(afterPartial);
    const corrupt = structuredClone(drafted);
    corrupt.franchise!.rookieDrafts![0].picks[0].releasedId = 999;
    reject(corrupt);
    const wrongBoundary = structuredClone(drafted);
    wrongBoundary.franchise!.rookieDrafts![0].tradeIndex = 0;
    if (offseason.franchise!.trades.length) reject(wrongBoundary);
    const year2 = startInteractiveFranchiseSeason(drafted, 93);
    const result = simulateSeason(year2.run),
      playoffs = simulatePlayoffs(result.league!, year2.run.seasonSeed);
    const archived = archiveFranchiseSeason({
      ...year2,
      run: {
        ...year2.run,
        result,
        playoffs,
        seasonProgress: { ...year2.run.seasonProgress!, completedRounds: 82 },
      },
    });
    expect(archived.franchise!.rookieDrafts).toEqual(
      drafted.franchise!.rookieDrafts,
    );
    expect(archived.franchise!.careers.length).toBeGreaterThan(240);
    const departed = draft.picks[0].releasedId;
    expect(
      archived.franchise!.careers.find((c) => c.pokemonId === departed)
        ?.seasons,
    ).toBe(1);
    expect(restore(archived).franchise).toEqual(archived.franchise);
    // Revalidates two complete seasons for many deliberately malformed saves.
  }, 600000);
});
