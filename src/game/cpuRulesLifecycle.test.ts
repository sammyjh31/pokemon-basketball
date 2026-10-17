import { beforeAll, describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { lotteryOrder } from "./draftLottery";
import { archiveFranchiseSeason } from "./franchise";
import { freeAgentMarket } from "./freeAgency";
import { processOffseason } from "./offseason";
import { loadGame } from "./persistence";
import { simulatePlayoffs } from "./playoffs";
import { draftTurn, recommendedRookiePick } from "./rookieDraft";
import { simulateSeason } from "./season";
import { gameReducer, initialState } from "./state";
import { ROSTER_SLOTS, type GameState } from "./types";

const restore = (state: GameState) =>
  loadGame({ getItem: () => JSON.stringify(state), setItem: () => {} }, 1);

let archived: GameState, drafted: GameState, signed: GameState;
beforeAll(() => {
  // A current coached franchise: every club has a trainer coach and the
  // shared evaluation (evaluationVersion 1) drives draft and market scores.
  const initial = {
    ...initialState(53),
    run: {
      ...createRun("free", true, 53),
      coach: { version: 1 as const, id: "misty" },
      roster: Object.fromEntries(
        ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
      ) as GameState["run"]["roster"],
    },
  };
  const result = simulateSeason(initial.run);
  const applied = gameReducer(initial, {
    type: "APPLY_SEASON",
    source: initial.run,
    result,
  });
  archived = archiveFranchiseSeason({
    ...applied,
    run: {
      ...applied.run,
      playoffs: simulatePlayoffs(result.league!, initial.run.seasonSeed),
    },
  });
  let s = gameReducer(processOffseason(archived), {
    type: "BEGIN_ROOKIE_DRAFT",
  });
  let passed = false;
  while (!s.franchise!.rookieDrafts!.at(-1)!.complete) {
    if (!passed) {
      s = gameReducer(s, { type: "PASS_ROOKIE_PICK" });
      passed = true;
      continue;
    }
    const pick = recommendedRookiePick(s.franchise!, 0, true)!;
    s = gameReducer(s, { type: "PICK_ROOKIE", ...pick });
  }
  drafted = s;
  for (const slot of ["B3", "B2"] as const)
    s = gameReducer(s, {
      type: "SIGN_FREE_AGENT",
      pokemonId: freeAgentMarket(s.franchise!)[0].pokemonId,
      releasedId: s.franchise!.teams[0].roster[slot]!,
    });
  signed = s;
}, 1800000);

describe("a franchise under CPU rules v1", () => {
  it("is created with the rules on the shared evaluation", () => {
    const f = archived.franchise!;
    expect(f.cpuRules).toEqual({ modelVersion: 1, since: 1 });
    expect(f.teams.every((t) => t.evaluationVersion === 1 && t.coach)).toBe(
      true,
    );
  });

  it("runs a lottery draft with passes, then CPU-first free agency", () => {
    const f = drafted.franchise!,
      draft = f.rookieDrafts![0],
      season = f.history[0];
    expect(draft.modelVersion).toBe(2);
    expect(draft.order).toEqual(
      lotteryOrder(season.standings, season.seasonSeed),
    );
    expect(draftTurn(draft)).toBe(60);
    const userPass = draft.passes!.find(
      (turn) => draft.order[(turn - 1) % 30] === 0,
    );
    expect(userPass).toBeDefined();
    expect(f.freeAgency!.cpuYears).toEqual([1]);
    expect(f.freeAgency!.transactions.every((t) => t.source === "cpu")).toBe(
      true,
    );
    // The third user signing is refused.
    const third = gameReducer(signed, {
      type: "SIGN_FREE_AGENT",
      pokemonId: freeAgentMarket(signed.franchise!)[0].pokemonId,
      releasedId: signed.franchise!.teams[0].roster.B1!,
    });
    expect(third).toBe(signed);
    expect(
      signed.franchise!.freeAgency!.transactions.filter(
        (t) => t.source === "user",
      ),
    ).toHaveLength(2);
  });

  it(
    "saves, validates and reloads unchanged, then starts year two",
    { timeout: 1800000 },
    () => {
      for (const state of [drafted, signed]) {
        const loaded = restore(state);
        expect(loaded.notice).toBeNull();
        expect(loaded.state.franchise).toEqual(state.franchise);
      }
      const tampered = structuredClone(signed);
      tampered.franchise!.rookieDrafts![0].modelVersion = 1;
      expect(restore(tampered).preserveSource).toBe(true);
      const next = gameReducer(signed, {
        type: "START_FRANCHISE_SEASON",
        seed: 5353,
      });
      expect(next.franchise!.year).toBe(2);
      expect(next.franchise!.cpuRules).toEqual({ modelVersion: 1, since: 1 });
      const loaded = restore(next);
      expect(loaded.notice).toBeNull();
      expect(loaded.state.franchise).toEqual(next.franchise);
    },
  );
});
