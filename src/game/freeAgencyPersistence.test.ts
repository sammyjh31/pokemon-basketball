import { beforeAll, describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { ROSTER_SLOTS, type GameState } from "./types";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { suggestTrades } from "./tradeMarket";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import {
  freeAgentMarket,
  processCpuFreeAgency,
  signFreeAgent,
} from "./freeAgency";
import { loadGame } from "./persistence";

let drafted: GameState;
beforeAll(() => {
  const run = {
    ...createRun("free", true, 47),
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
    ) as GameState["run"]["roster"],
  };
  const result = simulateSeason(run);
  drafted = beginRookieDraft(
    processOffseason(
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
    ),
  );
  while (!drafted.franchise!.rookieDrafts!.at(-1)!.complete) {
    const pick = recommendedRookiePick(drafted.franchise!, 0, true)!;
    drafted = selectRookie(drafted, pick.pokemonId, pick.releasedId);
  }
}, 60000);
const restore = (s: GameState) =>
  loadGame({ getItem: () => JSON.stringify(s), setItem: () => {} }, 1);
const sign = (s: GameState) =>
  signFreeAgent(
    s,
    freeAgentMarket(s.franchise!).find((p) =>
      s.franchise!.careers.some((c) => c.pokemonId === p.pokemonId),
    )!.pokemonId,
    s.franchise!.teams[0].roster.B3!,
  );

describe("free agency persistence and franchise lifecycle", () => {
  it("loads old draft saves and replays signings on either side of a trade", () => {
    expect(restore(drafted).state.franchise).toEqual(drafted.franchise);
    let next = sign(drafted);
    const suggestion = suggestTrades(next.franchise!, {
      packageSize: 1,
      limit: 1,
    })[0];
    expect(suggestion).toBeDefined();
    next = gameReducer(next, {
      type: "TRADE_PACKAGE",
      offer: suggestion.offer,
    });
    expect(next.franchise!.trades.length).toBe(
      drafted.franchise!.trades.length + 1,
    );
    next = sign(next);
    expect(
      next.franchise!.freeAgency!.transactions.map((t) => t.tradeIndex),
    ).toEqual([
      drafted.franchise!.trades.length,
      next.franchise!.trades.length,
    ]);
    const loaded = restore(next);
    expect(loaded.preserveSource).not.toBe(true);
    expect(loaded.state.franchise).toEqual(next.franchise);
    expect(loaded.state.run).toEqual(next.run);
  }, 90000);

  it("restores the CPU transaction ledger", () => {
    const valid = processCpuFreeAgency(sign(drafted));
    expect(
      valid.franchise!.freeAgency!.transactions.some((t) => t.source === "cpu"),
    ).toBe(true);
    expect(restore(valid).state.franchise).toEqual(valid.franchise);
  }, 45000);

  // Each corrupted save independently replays a complete season. Separate cases
  // keep the timeout scoped to one replay as simulation rules become richer.
  it.each<{ label: string; mutate: (state: GameState) => void }>([
    {
      label: "an undrafted signing",
      mutate: (s) => {
        s.franchise!.freeAgency!.transactions[0].pokemonId = 1025;
      },
    },
    {
      label: "a release owned by another team",
      mutate: (s) => {
        s.franchise!.freeAgency!.transactions[0].releasedId =
          s.franchise!.teams[2].roster.PG!;
      },
    },
    {
      label: "a future trade boundary",
      mutate: (s) => {
        s.franchise!.freeAgency!.transactions[0].tradeIndex =
          s.franchise!.trades.length + 1;
      },
    },
    {
      label: "a user signing for a CPU team",
      mutate: (s) => {
        s.franchise!.freeAgency!.transactions[0].teamId = 2;
      },
    },
    {
      label: "duplicate CPU rounds",
      mutate: (s) => {
        s.franchise!.freeAgency!.cpuYears.push(1);
      },
    },
    {
      label: "CPU signings without a completed round",
      mutate: (s) => {
        s.franchise!.freeAgency!.cpuYears = [];
      },
    },
    {
      label: "an unsupported ledger version",
      mutate: (s) => {
        s.franchise!.freeAgency!.modelVersion = 2 as never;
      },
    },
    {
      label: "an erased signing ledger",
      mutate: (s) => {
        delete s.franchise!.freeAgency;
      },
    },
  ])(
    "rejects $label without overwriting the save",
    ({ mutate }) => {
      const bad = structuredClone(processCpuFreeAgency(sign(drafted)));
      mutate(bad);
      expect(restore(bad).preserveSource).toBe(true);
    },
    90000,
  );

  it("runs CPU free agency automatically before year two and retains its ledger and returning careers after that season", () => {
    const signed = sign(drafted);
    let next = gameReducer(signed, {
      type: "START_FRANCHISE_SEASON",
      seed: 93,
    });
    expect(next.franchise!.year).toBe(2);
    expect(next.franchise!.freeAgency!.cpuYears).toEqual([1]);
    expect(next.franchise!.teams[0]).toEqual(signed.franchise!.teams[0]);
    expect(next.run.leagueTeams).toEqual(next.franchise!.teams);
    expect(restore(next).state.franchise).toEqual(next.franchise);
    next = gameReducer(next, { type: "SELECT_COACH", id: "mom" });
    const result = simulateSeason(next.run),
      playoffs = simulatePlayoffs(result.league!, next.run.seasonSeed);
    const archived = archiveFranchiseSeason({
      ...next,
      run: {
        ...next.run,
        result,
        playoffs,
        seasonProgress: { ...next.run.seasonProgress!, completedRounds: 82 },
      },
    });
    expect(archived.franchise!.freeAgency).toEqual(next.franchise!.freeAgency);
    const returned = signed.franchise!.freeAgency!.transactions[0].pokemonId;
    expect(archived.franchise!.phase).toBe("offseason");
    expect(archived.franchise!.history).toHaveLength(2);
    expect(
      archived.franchise!.careers.find((c) => c.pokemonId === returned)
        ?.seasons,
    ).toBe(2);
    const unsigned = freeAgentMarket(next.franchise!).map((p) => p.pokemonId);
    expect(
      freeAgentMarket(archived.franchise!).map((p) => p.pokemonId),
    ).toEqual(unsigned);
    expect(restore(archived).state.franchise).toEqual(archived.franchise);
  }, 180000);
});
