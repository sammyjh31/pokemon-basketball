import { describe, expect, it } from "vitest";
import { ROOKIE_POKEMON } from "../data/pokemon";
import { governed, standings, transactions } from "./cpuRules.testUtils";
import {
  LOTTERY_DRAWS,
  LOTTERY_TEAMS,
  lotteryOrder,
  recordOrder,
  seededRecordOrder,
} from "./draftLottery";
import { positionRating } from "./ratings";
import { beginRookieDraft, draftTurn, passRookiePick } from "./rookieDraft";
import { rookieFixture } from "./rookieDraft.testUtils";
import { POSITIONS } from "./types";

describe("rookie draft lottery", () => {
  const rows = standings((id) => 20 + id);

  it("lets the 14 non-playoff clubs draw for four picks, then follows record order", () => {
    const record = recordOrder(rows);
    for (const seed of [1, 2, 3, 99, 0xffffffff]) {
      const order = lotteryOrder(rows, seed);
      expect(order).toEqual(lotteryOrder(rows, seed));
      expect([...order].sort((a, b) => a - b)).toEqual(
        [...record].sort((a, b) => a - b),
      );
      const lottery = record.slice(0, LOTTERY_TEAMS);
      const winners = order.slice(0, LOTTERY_DRAWS);
      expect(winners.every((id) => lottery.includes(id))).toBe(true);
      expect(order.slice(LOTTERY_DRAWS, LOTTERY_TEAMS)).toEqual(
        lottery.filter((id) => !winners.includes(id)),
      );
      expect(order.slice(LOTTERY_TEAMS)).toEqual(record.slice(LOTTERY_TEAMS));
    }
  });

  it("weights the first pick toward the worst records", () => {
    const first = new Map<number, number>();
    for (let seed = 0; seed < 3000; seed++) {
      const id = lotteryOrder(rows, seed * 7919)[0];
      first.set(id, (first.get(id) ?? 0) + 1);
    }
    const share = (id: number) => (first.get(id) ?? 0) / 3000;
    expect(share(0)).toBeGreaterThan(0.1);
    expect(share(0)).toBeLessThan(0.18);
    expect(share(0)).toBeGreaterThan(share(6));
    expect(share(6)).toBeGreaterThan(share(13));
    expect(share(13)).toBeGreaterThan(0);
    expect([...first.keys()].every((id) => id < LOTTERY_TEAMS)).toBe(true);
  });

  it("breaks exact ties with a seeded draw instead of team id", () => {
    const level = standings(() => 41);
    expect(recordOrder(level)[0]).toBe(0);
    const firsts = new Set(
      Array.from(
        { length: 60 },
        (_, seed) => seededRecordOrder(level, seed)[0],
      ),
    );
    expect(firsts.size).toBeGreaterThan(10);
    // Distinct records still decide the order.
    expect(seededRecordOrder(rows, 5)).toEqual(recordOrder(rows));
  });

  it("opens a model-2 draft with the lottery order under the rules", () => {
    const state = governed(),
      season = state.franchise!.history[0];
    const draft = beginRookieDraft(state).franchise!.rookieDrafts![0];
    expect(draft.modelVersion).toBe(2);
    expect(draft.order).toEqual(
      lotteryOrder(season.standings, season.seasonSeed),
    );
    expect(
      beginRookieDraft(rookieFixture()).franchise!.rookieDrafts![0],
    ).toMatchObject({
      modelVersion: 1,
      order: recordOrder(season.standings),
    });
  });

  it("lets CPU clubs pass rather than release better players", () => {
    const state = governed(),
      f = state.franchise!;
    // Leave only the three weakest Gen III prospects in the class.
    const ability = (id: number) =>
      Math.max(
        ...POSITIONS.map((p) =>
          positionRating(
            ROOKIE_POKEMON.find((m) => m.id === id)!,
            p,
          ),
        ),
      );
    const gen3 = ROOKIE_POKEMON.filter((m) => m.generation === 3).sort(
      (a, b) => ability(a.id) - ability(b.id),
    );
    f.history[0].rosters.push(gen3.slice(3).map((m) => m.id));
    const next = beginRookieDraft(state).franchise!,
      draft = next.rookieDrafts![0];
    expect(draft.passes!.length).toBeGreaterThan(0);
    for (const turn of draft.passes!) {
      const teamId = draft.order[(turn - 1) % 30];
      expect(teamId).not.toBe(0);
      expect(next.teams[teamId].roster).toEqual(f.teams[teamId].roster);
    }
    expect(draft.order[draftTurn(draft) % 30]).toBe(0);
  });

  it("lets the user pass in a model-2 draft only", () => {
    const state = beginRookieDraft(governed()),
      draft = state.franchise!.rookieDrafts![0],
      turn = draftTurn(draft);
    expect(draft.order[turn % 30]).toBe(0);
    const passed = passRookiePick(state),
      after = passed.franchise!.rookieDrafts![0];
    expect(after.passes).toContain(turn + 1);
    expect(passed.franchise!.teams[0].roster).toEqual(
      state.franchise!.teams[0].roster,
    );
    expect(draftTurn(after)).toBeGreaterThan(turn + 1);
    const legacy = beginRookieDraft(rookieFixture());
    expect(passRookiePick(legacy)).toBe(legacy);
  });

  it("validates completed model-2 drafts and rejects tampered ones", () => {
    let state = beginRookieDraft(governed());
    while (!state.franchise!.rookieDrafts![0].complete)
      state = passRookiePick(state);
    const f = state.franchise!;
    expect(draftTurn(f.rookieDrafts![0])).toBe(60);
    expect(passRookiePick(state)).toBe(state);
    expect(transactions(f).drafts).toEqual(f.rookieDrafts);
    const tamper = (change: (draft: Record<string, unknown>) => void) => {
      const copy = structuredClone(f);
      change(copy.rookieDrafts![0] as unknown as Record<string, unknown>);
      return () => transactions(copy);
    };
    expect(tamper((d) => (d.modelVersion = 1))).toThrow();
    expect(tamper((d) => delete d.passes)).toThrow();
    expect(
      tamper((d) => (d.order = recordOrder(f.history[0].standings))),
    ).toThrow();
    expect(
      tamper((d) => {
        const passes = d.passes as number[];
        passes.push(passes.at(-1)!);
      }),
    ).toThrow();
    // A legacy franchise may not hold a model-2 draft.
    expect(() =>
      transactions({ ...structuredClone(f), cpuRules: undefined }),
    ).toThrow();
  });
});
