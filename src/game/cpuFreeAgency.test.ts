import { describe, expect, it } from "vitest";
import { drafted, modernGoverned, transactions } from "./cpuRules.testUtils";
import type { Franchise } from "./franchiseTypes";
import {
  cpuFreeAgentChoice,
  evaluateFreeAgentSigning,
  freeAgentMarket,
  processCpuFreeAgency,
  signFreeAgent,
} from "./freeAgency";
import { validateFreeAgency } from "./freeAgencyValidation";
import { advanceRookieDraft, draftTurn } from "./rookieDraft";
import { rookieFixture } from "./rookieDraft.testUtils";
import { ROSTER_SLOTS } from "./types";

describe("free agency under CPU rules", () => {
  it("runs the CPU pass when the draft closes, worst records first, up to two signings each", () => {
    const state = drafted(),
      f = state.franchise!;
    expect(f.freeAgency!.cpuYears).toEqual([1]);
    const cpu = f.freeAgency!.transactions;
    expect(cpu.every((t) => t.source === "cpu" && t.teamId > 0)).toBe(true);
    expect(cpu.length).toBeGreaterThan(0);
    const counts = new Map<number, number>();
    for (const t of cpu) counts.set(t.teamId, (counts.get(t.teamId) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
    const rookies = new Set(f.rookieDrafts![0].picks.map((p) => p.pokemonId));
    expect(cpu.some((t) => rookies.has(t.releasedId))).toBe(false);
    expect(processCpuFreeAgency(state)).toBe(state);
    expect(transactions(f).expected).toEqual(
      f.teams.map((team) => ROSTER_SLOTS.map((slot) => team.roster[slot]!)),
    );
  });

  it("gives a club a second signing only when it clearly helps", () => {
    const rules = { modelVersion: 1 as const, since: 1 };
    const choices = (f: Franchise) =>
      f.teams.slice(1).flatMap((team) => {
        const first = cpuFreeAgentChoice(f, team.id, 0, false);
        return first
          ? [{ first, second: cpuFreeAgentChoice(f, team.id, 1, false) }]
          : [];
      });
    // A second signing needs score >= 4 and a +0.1 team rating gain.
    const clears = (evaluation: {
      score: number;
      teamAfter: number;
      teamBefore: number;
    }) =>
      evaluation.score >= 4 &&
      evaluation.teamAfter >= evaluation.teamBefore + 0.1;
    // The ordinary market holds mostly marginal upgrades: first-round moves only.
    const thin = drafted(rookieFixture());
    const marginal = choices({ ...thin.franchise!, cpuRules: rules });
    expect(marginal.some((row) => !row.second)).toBe(true);
    for (const row of marginal) {
      if (row.second) expect(clears(row.second.evaluation)).toBe(true);
      if (clears(row.first.evaluation)) expect(row.second).toEqual(row.first);
    }
    // Under the old rules the user may release strong veterans before the
    // CPU pass; each released star clears the second-round bar too.
    let state = thin;
    for (const released of [149, 143, 68, 59])
      state = signFreeAgent(
        state,
        freeAgentMarket(state.franchise!, false).at(-1)!.pokemonId,
        released,
      );
    const f = { ...state.franchise!, cpuRules: rules };
    for (const row of choices(f)) {
      expect(row.first.evaluation.score).toBeGreaterThanOrEqual(4);
      expect(row.second).toEqual(row.first);
    }
    const result = processCpuFreeAgency({ ...state, franchise: f });
    const rows = result.franchise!.freeAgency!.transactions.filter(
      (t) => t.source === "cpu",
    );
    // Each club gets its first chance before anyone signs twice.
    const repeat = rows.findIndex(
      (t, index) => rows.findIndex((r) => r.teamId === t.teamId) !== index,
    );
    const firstRound = repeat < 0 ? rows : rows.slice(0, repeat);
    expect(new Set(firstRound.map((t) => t.teamId)).size).toBe(
      firstRound.length,
    );
  });

  it("asks the user to wait for the CPU pass and caps user signings at two", () => {
    const state = drafted(),
      f = state.franchise!;
    const early = structuredClone(f);
    delete early.freeAgency;
    const agent = () => freeAgentMarket(early, false)[0];
    expect(
      evaluateFreeAgentSigning(
        early,
        0,
        agent().pokemonId,
        early.teams[0].roster.B3!,
        false,
      ).reason,
    ).toMatch(/CPU clubs make their free-agent moves first/);
    let next = state;
    for (const slot of ["B3", "B2"] as const) {
      const signed = signFreeAgent(
        next,
        freeAgentMarket(next.franchise!, false)[0].pokemonId,
        next.franchise!.teams[0].roster[slot]!,
      );
      expect(signed).not.toBe(next);
      next = signed;
    }
    const third = evaluateFreeAgentSigning(
      next.franchise!,
      0,
      freeAgentMarket(next.franchise!, false)[0].pokemonId,
      next.franchise!.teams[0].roster.B1!,
      false,
    );
    expect(third.eligible).toBe(false);
    expect(third.reason).toMatch(/2 free agents per offseason/);
    expect(transactions(next.franchise!).drafts).toEqual(
      next.franchise!.rookieDrafts,
    );
  });

  it("validates governed offseasons and leaves earlier years on the old limits", () => {
    const row = (
      source: "cpu" | "user",
      teamId: number,
      pokemonId: number,
    ) => ({
      year: 1,
      teamId,
      pokemonId,
      releasedId: pokemonId + 1,
      tradeIndex: 0,
      source,
      reason: "test",
    });
    const save = (rows: ReturnType<typeof row>[]) => ({
      modelVersion: 1,
      cpuYears: [1],
      transactions: rows,
    });
    const users = [row("user", 0, 10), row("user", 0, 20), row("user", 0, 30)];
    expect(() => validateFreeAgency(save(users), 1, 0, true)).not.toThrow();
    expect(() => validateFreeAgency(save(users), 1, 0, true, 1)).toThrow();
    expect(() =>
      validateFreeAgency(save(users.slice(0, 2)), 1, 0, true, 1),
    ).not.toThrow();
    const twice = [row("cpu", 4, 10), row("cpu", 4, 20)];
    expect(() => validateFreeAgency(save(twice), 1, 0, true, 1)).not.toThrow();
    expect(() => validateFreeAgency(save(twice), 1, 0, true)).toThrow();
    expect(() =>
      validateFreeAgency(save([...twice, row("cpu", 4, 30)]), 1, 0, true, 1),
    ).toThrow();
    // The user may not move before the CPU pass in a governed year.
    expect(() =>
      validateFreeAgency(
        save([row("user", 0, 40), row("cpu", 4, 10)]),
        1,
        0,
        true,
        1,
      ),
    ).toThrow();
    expect(() =>
      validateFreeAgency(
        { ...save([row("user", 0, 40)]), cpuYears: [] },
        1,
        0,
        true,
        1,
      ),
    ).toThrow();
  });

  it("keeps the advance helper idempotent once the market has opened", () => {
    const state = drafted();
    expect(advanceRookieDraft(state)).toBe(state);
  });
});

describe("CPU rules on the shared evaluation", () => {
  it(
    "drafts, passes and signs with shared team value in a coached league",
    { timeout: 1800000 },
    () => {
      const start = modernGoverned();
      expect(
        start.franchise!.teams.every(
          (t) => t.evaluationVersion === 1 && t.coach,
        ),
      ).toBe(true);
      const state = drafted(start),
        f = state.franchise!,
        draft = f.rookieDrafts![0];
      expect(draft.modelVersion).toBe(2);
      expect(draftTurn(draft)).toBe(60);
      // A pass means the club's best shared-value swap would not help it.
      for (const turn of draft.passes!)
        expect(draft.order[(turn - 1) % 30]).toBeDefined();
      expect(f.freeAgency!.cpuYears).toEqual([1]);
      const counts = new Map<number, number>();
      for (const t of f.freeAgency!.transactions)
        counts.set(t.teamId, (counts.get(t.teamId) ?? 0) + 1);
      expect(Math.max(0, ...counts.values())).toBeLessThanOrEqual(2);
      // Second-round bar: twice the shared first-round bar (0.15).
      for (const team of f.teams.slice(1)) {
        const second = cpuFreeAgentChoice(f, team.id, 1, false);
        if (second) expect(second.evaluation.score).toBeGreaterThanOrEqual(0.3);
      }
    },
  );
});
