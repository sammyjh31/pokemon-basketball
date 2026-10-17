import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import * as rosterTrades from "./rosterTrades";
import { ROSTER_SLOTS, type Run } from "./types";
import type { Franchise } from "./franchiseTypes";

function fixture(): Franchise {
  const run: Run = {
    ...createRun("free", true, 47),
    evaluationVersion: undefined,
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((slot, i) => [
        slot,
        [65, 150, 149, 68, 143, 9, 94, 59][i],
      ]),
    ) as Run["roster"],
  };
  return {
    modelVersion: 3,
    year: 1,
    phase: "offseason",
    teams: createLeague(run),
    careers: [],
    history: [],
    trades: [],
  };
}

describe("atomic package exchange", () => {
  it("moves all development by species and preserves unaffected slots and source snapshots", () => {
    const f = fixture(),
      a = f.teams[0],
      b = f.teams[1];
    const give = [a.roster.PG!, a.roster.B1!],
      receive = [b.roster.SG!, b.roster.C!];
    a.development = { [give[0]]: { passing: 7 }, [give[1]]: { threePoint: 5 } };
    // A receiving club without a development map must still acquire developed players.
    const before = structuredClone(f.teams);
    const result = rosterTrades.exchangePackage(f.teams, 0, 1, give, receive);
    expect(f.teams).toEqual(before);
    expect(result[0].roster.SG).toBe(150);
    expect(result[0].roster.B2).toBe(94);
    expect(new Set([result[0].roster.PG, result[0].roster.B1])).toEqual(
      new Set(receive),
    );
    expect(new Set([result[1].roster.SG, result[1].roster.C])).toEqual(
      new Set(give),
    );
    expect(result[1].development?.[give[0]]).toEqual({ passing: 7 });
    expect(result[1].development?.[give[1]]).toEqual({ threePoint: 5 });
    expect(result[0].development?.[give[0]]).toBeUndefined();
    expect(result[2]).toBe(f.teams[2]);
    expect(new Set(result.flatMap((t) => Object.values(t.roster))).size).toBe(
      240,
    );
    expect(
      rosterTrades.exchangePackage(
        f.teams,
        0,
        1,
        [...give].reverse(),
        [...receive].reverse(),
      ),
    ).toEqual(result);
  });

  it("keeps custom minutes and closers on their original slots in a three-player exchange", () => {
    const f = fixture(),
      a = f.teams[0],
      b = f.teams[1];
    a.rotationPlan = {
      minutes: {
        PG: 36,
        SG: 36,
        SF: 34,
        PF: 34,
        C: 32,
        B1: 24,
        B2: 24,
        B3: 20,
      },
      closing: ["PG", "SG", "SF", "PF", "B1"],
    };
    const give = [a.roster.PG!, a.roster.SG!, a.roster.B1!],
      receive = [b.roster.PG!, b.roster.C!, b.roster.B2!];
    const result = rosterTrades.exchangePackage(f.teams, 0, 1, give, receive);
    expect(result[0].rotationPlan).toEqual(a.rotationPlan);
    expect(result[0].roster.SF).toBe(149);
    expect(result[0].roster.C).toBe(143);
    expect(
      new Set([result[0].roster.PG, result[0].roster.SG, result[0].roster.B1]),
    ).toEqual(new Set(receive));
  });

  it("returns unchanged teams for stale, duplicate, unequal or oversized packages", () => {
    const f = fixture(),
      give = Object.values(f.teams[0].roster) as number[],
      receive = Object.values(f.teams[1].roster) as number[];
    for (const [out, incoming] of [
      [[], []],
      [[give[0], give[0]], receive.slice(0, 2)],
      [give.slice(0, 2), receive.slice(0, 1)],
      [give.slice(0, 4), receive.slice(0, 4)],
      [[receive[0]], [give[0]]],
    ])
      expect(rosterTrades.exchangePackage(f.teams, 0, 1, out, incoming)).toBe(
        f.teams,
      );
  });
});

import {
  clubTradeProfile,
  cpuMarketTrades,
  evaluateTradePackage,
  suggestTrades,
  tradeMarketPlayers,
} from "./tradeMarket";
import type { FranchiseSeason } from "./franchiseTypes";

function season(f: Franchise, wins: number, championId = 29): FranchiseSeason {
  return {
    year: 1,
    seasonSeed: 47,
    standings: f.teams.map((t) => ({
      teamId: t.id,
      wins: t.id === 1 ? wins : 41,
      losses: t.id === 1 ? 82 - wins : 41,
      pointsFor: 8000,
      pointsAgainst: 8000,
      homeWins: 20,
      awayWins: 21,
      streak: 0,
      lastTen: 5,
    })),
    rosters: f.teams.map((t) => Object.values(t.roster) as number[]),
    awards: [],
    allLeague: [],
    allDefense: [],
    championId,
    runnerUpId: 28,
    runnerUpWins: 2,
    finalsMvp: {
      pokemonId: 1,
      playerId: "29:1",
      teamId: championId,
      score: 1,
      value: "Finals MVP",
    },
  };
}

describe("coach-aware trade evaluation", () => {
  it("derives club direction from completed records and championship continuity", () => {
    const f = fixture();
    expect(
      clubTradeProfile({ ...f, history: [season(f, 60)] }, 1).direction,
    ).toBe("contend");
    expect(
      clubTradeProfile({ ...f, history: [season(f, 20)] }, 1).direction,
    ).toBe("develop");
    expect(
      clubTradeProfile({ ...f, history: [season(f, 41)] }, 1).direction,
    ).toBe("retool");
    expect(
      clubTradeProfile({ ...f, history: [season(f, 20, 1)] }, 1).direction,
    ).toBe("contend");
  });
  it("lists every opponent with truthful role, availability, price reason and recent trend", () => {
    const f = fixture(),
      id = f.teams[1].roster.PG!;
    f.offseasons = [
      {
        modelVersion: 1,
        year: 1,
        tradeStart: 0,
        tradeCount: 0,
        players: [
          {
            pokemonId: id,
            teamId: 1,
            before: 50,
            after: 56,
            minutesPerGame: 30,
            impactPer36: 22,
            changes: { passing: 6 },
            outcome: "growth",
            reasons: [],
          },
        ],
      },
    ];
    const market = tradeMarketPlayers(f);
    expect(market).toHaveLength(232);
    expect(new Set(market.map((p) => p.pokemonId)).size).toBe(232);
    expect(
      market.every(
        (p) =>
          p.teamId > 0 &&
          p.rating > 0 &&
          p.reason.length > 10 &&
          p.role.length > 0,
      ),
    ).toBe(true);
    expect(market.find((p) => p.pokemonId === id)?.trend).toBe(6);
    expect(new Set(market.map((p) => p.availability))).toEqual(
      new Set(["available", "listening", "core"]),
    );
  });
  it("rejects stale, invalid and in-season proposals without evaluating partial rosters", () => {
    const f = fixture(),
      receive = f.teams[1].roster.B3!;
    for (const offer of [
      { teamId: 0, giveIds: [150], receiveIds: [receive] },
      {
        teamId: 1,
        giveIds: [150, 150],
        receiveIds: [receive, f.teams[1].roster.B2!],
      },
      { teamId: 1, giveIds: [150], receiveIds: [] },
      { teamId: 1, giveIds: [receive], receiveIds: [150] },
    ])
      expect(evaluateTradePackage(f, offer).accepted).toBe(false);
    expect(
      evaluateTradePackage(
        { ...f, phase: "season" },
        { teamId: 1, giveIds: [150], receiveIds: [receive] },
      ).accepted,
    ).toBe(false);
    const corrupt = structuredClone(f);
    corrupt.teams[4].roster.PG = 150;
    expect(
      evaluateTradePackage(corrupt, {
        teamId: 1,
        giveIds: [150],
        receiveIds: [receive],
      }).accepted,
    ).toBe(false);
  });
  it("blocks trade previews and market negotiations while the current rookie draft is partial", () => {
    const f = fixture();
    f.rookieDrafts = [
      {
        modelVersion: 1,
        year: f.year,
        generation: 3,
        order: f.teams.map((t) => t.id),
        picks: [],
        complete: false,
        tradeIndex: 0,
      },
    ];
    const evaluation = evaluateTradePackage(f, {
      teamId: 1,
      giveIds: [150],
      receiveIds: [f.teams[1].roster.B3!],
    });
    expect(evaluation.accepted).toBe(false);
    expect(evaluation.reason).toMatch(/draft/i);
    expect(suggestTrades(f)).toEqual([]);
    expect(cpuMarketTrades(f)).toEqual({ teams: f.teams, trades: [] });
  });
  it("accepts an obvious upgrade, explains all priorities, and is invariant to package order", () => {
    const f = fixture(),
      offer = {
        teamId: 1,
        giveIds: [150, 149],
        receiveIds: [f.teams[1].roster.B2!, f.teams[1].roster.B3!],
      };
    const evaluation = evaluateTradePackage(f, offer);
    expect(evaluation.accepted).toBe(true);
    expect(evaluation.factors.map((factor) => factor.label)).toEqual(
      expect.arrayContaining([
        "Player ability",
        "Rotation fit",
        "Coaching scheme",
        "Positional depth",
        "Roster needs",
        "Development trend",
        "Continuity",
      ]),
    );
    expect(
      evaluation.factors.every(
        (factor) =>
          factor.detail.length > 10 && Number.isFinite(factor.contribution),
      ),
    ).toBe(true);
    expect(evaluation.score).toBeCloseTo(
      evaluation.factors.reduce((sum, factor) => sum + factor.contribution, 0),
    );
    expect(
      evaluateTradePackage(f, {
        ...offer,
        giveIds: [...offer.giveIds].reverse(),
        receiveIds: [...offer.receiveIds].reverse(),
      }),
    ).toEqual(evaluation);
  });
  it("protects star ability even when a low-tier player might fit a vacant role", () => {
    const f = fixture();
    f.teams[0].roster.SG = 129;
    const target = tradeMarketPlayers(f).sort((a, b) => b.rating - a.rating)[0];
    const evaluation = evaluateTradePackage(f, {
      teamId: target.teamId,
      giveIds: [129],
      receiveIds: [target.pokemonId],
    });
    expect(evaluation.accepted).toBe(false);
    expect(evaluation.reason).toMatch(/talent|ability/i);
  });
  it("makes scheme preference and recent development change value without changing raw player ability", () => {
    const f = fixture(),
      offer = {
        teamId: 1,
        giveIds: [150],
        receiveIds: [f.teams[1].roster.B3!],
      };
    const baseline = evaluateTradePackage(f, offer);
    const shooting = {
      ...f,
      teams: f.teams.map((t) =>
        t.id === 1
          ? { ...t, tactic: "perimeter" as const, defense: "switch" as const }
          : t,
      ),
    };
    const scheme = evaluateTradePackage(shooting, offer);
    expect(scheme.outgoingValue).toBe(baseline.outgoingValue);
    expect(scheme.incomingValue).toBe(baseline.incomingValue);
    expect(
      scheme.factors.find((v) => v.label === "Coaching scheme")!.contribution,
    ).not.toBe(
      baseline.factors.find((v) => v.label === "Coaching scheme")!.contribution,
    );
    const developing = {
      ...f,
      history: [season(f, 20)],
      offseasons: [
        {
          modelVersion: 1 as const,
          year: 1,
          tradeStart: 0,
          tradeCount: 0,
          players: [
            {
              pokemonId: 150,
              teamId: 0,
              before: 70,
              after: 76,
              minutesPerGame: 30,
              impactPer36: 25,
              changes: { passing: 6 },
              outcome: "growth" as const,
              reasons: [],
            },
          ],
        },
      ],
    };
    const growth = evaluateTradePackage(developing, offer);
    expect(growth.outgoingValue).toBe(baseline.outgoingValue);
    expect(
      growth.factors.find((v) => v.label === "Development trend")!.contribution,
    ).toBeGreaterThan(0);
    expect(
      baseline.factors.find((v) => v.label === "Development trend")!
        .contribution,
    ).toBe(0);
  });
  it("allows a core player to move for a strong offer instead of imposing an unavailable flag", () => {
    const f = fixture();
    const core = tradeMarketPlayers(f)
      .filter((player) => player.availability === "core")
      .sort((a, b) => a.rating - b.rating)[0];
    expect(
      evaluateTradePackage(f, {
        teamId: core.teamId,
        giveIds: [150],
        receiveIds: [core.pokemonId],
      }).accepted,
    ).toBe(true);
  });
  it("prices the same package differently for a developing club and title holder", () => {
    const f = fixture(),
      offer = {
        teamId: 1,
        giveIds: [150],
        receiveIds: [f.teams[1].roster.PG!],
      };
    const rebuilding = evaluateTradePackage(
      { ...f, history: [season(f, 20)] },
      offer,
    );
    const champion = evaluateTradePackage(
      { ...f, history: [season(f, 60, 1)] },
      offer,
    );
    expect(champion.threshold).toBeGreaterThan(rebuilding.threshold);
    expect(
      champion.factors.find((v) => v.label === "Continuity")!.contribution,
    ).toBeLessThan(
      rebuilding.factors.find((v) => v.label === "Continuity")!.contribution,
    );
  });
});

describe("bounded trade suggestions and CPU market", () => {
  it("returns deterministic accepted suggestions, honoring targets and fixed outgoing packages", () => {
    const f = fixture(),
      targetId = f.teams[1].roster.B3!;
    const suggestions = suggestTrades(f, {
      teamId: 1,
      targetId,
      giveIds: [150, 149],
      packageSize: 2,
      limit: 4,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(4);
    for (const suggestion of suggestions) {
      expect(suggestion.offer.giveIds).toEqual([149, 150]);
      expect(suggestion.offer.receiveIds).toHaveLength(2);
      expect(suggestion.offer.receiveIds).toContain(targetId);
      expect(suggestion.offer.teamId).toBe(1);
      expect(evaluateTradePackage(f, suggestion.offer).accepted).toBe(true);
      expect(suggestion.evaluation).toEqual(
        evaluateTradePackage(f, suggestion.offer),
      );
    }
    expect(
      suggestTrades(f, {
        teamId: 1,
        targetId,
        giveIds: [149, 150],
        packageSize: 2,
        limit: 4,
      }),
    ).toEqual(suggestions);
  });
  it("handles impossible constraints and non-positive limits without accidental broad searches", () => {
    const f = fixture();
    expect(suggestTrades(f, { limit: 0 })).toEqual([]);
    expect(suggestTrades(f, { giveIds: [999999] })).toEqual([]);
    expect(
      suggestTrades(f, { teamId: 1, targetId: f.teams[2].roster.PG! }),
    ).toEqual([]);
    expect(suggestTrades(f, { giveIds: [150], packageSize: 2 })).toEqual([]);
    expect(cpuMarketTrades(f, 0)).toEqual({ teams: f.teams, trades: [] });
  });
  it("makes reproducible mutually accepted package trades between at most six disjoint CPU pairs", () => {
    const f = fixture(),
      before = structuredClone(f);
    const result = cpuMarketTrades(f);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(result.trades.length).toBeLessThanOrEqual(6);
    expect(result.trades.some((t) => t.giveIds!.length > 1)).toBe(true);
    expect(
      new Set(result.trades.flatMap((t) => [t.fromTeamId, t.teamId])).size,
    ).toBe(result.trades.length * 2);
    expect(result.teams[0]).toBe(f.teams[0]);
    expect(
      new Set(result.teams.flatMap((t) => Object.values(t.roster))).size,
    ).toBe(240);
    for (const trade of result.trades) {
      expect(trade.fromTeamId).toBeGreaterThan(0);
      expect(trade.packageVersion).toBe(1);
      expect(trade.giveId).toBe(trade.giveIds![0]);
      expect(trade.receiveId).toBe(trade.receiveIds![0]);
      expect(
        evaluateTradePackage(
          f,
          {
            teamId: trade.teamId,
            giveIds: trade.giveIds!,
            receiveIds: trade.receiveIds!,
          },
          trade.fromTeamId,
        ).accepted,
      ).toBe(true);
      expect(
        evaluateTradePackage(
          f,
          {
            teamId: trade.fromTeamId!,
            giveIds: trade.receiveIds!,
            receiveIds: trade.giveIds!,
          },
          trade.teamId,
        ).accepted,
      ).toBe(true);
    }
    expect(f).toEqual(before);
    expect(cpuMarketTrades(f)).toEqual(result);
  });
});
