import { describe, expect, it } from "vitest";
import { ROOKIE_POKEMON } from "../data/pokemon";
import { rookieFixture } from "./rookieDraft.testUtils";
import { compareTeamEvaluation, evaluateTeam } from "./teamEvaluation";
import {
  cpuMarketTrades,
  evaluateTradePackage,
  suggestTrades,
} from "./tradeMarket";
import { cpuTrades, exchangePackage, exchangePlayers } from "./rosterTrades";
import {
  evaluateFreeAgentSigning,
  freeAgentMarket,
  processCpuFreeAgency,
} from "./freeAgency";
import { recommendedRookiePick } from "./rookieDraft";
import { ROSTER_SLOTS, type LeagueTeam, type RosterSlot } from "./types";
import type { DevelopmentRatings } from "./developmentTypes";
import { projectedCoaches } from "./coachOffice";

function modernFixture() {
  const state = rookieFixture();
  state.franchise!.teams = state.franchise!.teams.map((team) => ({
    ...team,
    evaluationVersion: 1 as const,
    abilityVersion: 1 as const,
    coach: { version: 1 as const, id: "brock" },
  }));
  return state;
}
function replacement(
  team: LeagueTeam,
  slot: RosterSlot,
  id: number,
  offsets: DevelopmentRatings = {},
) {
  return {
    ...team,
    roster: { ...team.roster, [slot]: id },
    development: { ...team.development, [id]: offsets },
  };
}
function marketFixture() {
  const state = modernFixture(),
    f = state.franchise!;
  state.run.includeLegends = true;
  const owned = new Set(f.teams.flatMap((t) => Object.values(t.roster)));
  const released = Array.from({ length: 251 }, (_, index) => index + 1).filter(
    (id) => !owned.has(id),
  );
  f.rookieDrafts = [
    {
      modelVersion: 1,
      year: 1,
      generation: 3,
      order: f.teams.map((t) => t.id),
      complete: true,
      tradeIndex: 0,
      picks: released.map((id, index) => ({
        pick: index + 1,
        round: 1,
        teamId: index % 30,
        pokemonId: 252 + index,
        releasedId: id,
      })),
    },
  ];
  return state;
}

describe("shared market evaluation", () => {
  it("does not offer a cached free agent after another club acquires it in an edited snapshot", () => {
    const f = marketFixture().franchise!;
    const agent = freeAgentMarket(f)[0];
    f.teams[1].roster.PG = agent.pokemonId;
    expect(
      evaluateFreeAgentSigning(f, 0, agent.pokemonId, f.teams[0].roster.PG!)
        .eligible,
    ).toBe(false);
  });

  it("keeps developed incoming skills in a modern one-player exchange even for an undeveloped receiving club", () => {
    const teams = modernFixture().franchise!.teams;
    const give = teams[0].roster.PG!,
      receive = teams[1].roster.PG!;
    delete teams[0].development;
    teams[1].development = { [receive]: { passing: 12 } };
    expect(
      exchangePlayers(teams, 0, 1, give, receive)[0].development?.[receive],
    ).toEqual({ passing: 12 });
  });

  it("uses shared improvement in the older single-player CPU trading entry point when enabled", () => {
    const original = modernFixture().franchise!.teams.slice(0, 12);
    const teams = exchangePlayers(
      original,
      1,
      2,
      original[1].roster.PG!,
      original[2].roster.C!,
    );
    const result = cpuTrades(teams, 1, 47, 2);
    expect(result.trades.length).toBeGreaterThan(0);
    for (const trade of result.trades) {
      expect(trade.reason).toContain("shared team value");
      for (const id of [trade.fromTeamId!, trade.teamId])
        expect(
          compareTeamEvaluation(teams[id], result.teams[id]).delta,
        ).toBeGreaterThan(0);
    }
  });

  it("assigns traded packages to the strongest shared-value vacant-slot arrangement", () => {
    const f = modernFixture().franchise!;
    f.teams[0].rotationPlan = {
      minutes: {
        PG: 10,
        SG: 48,
        SF: 30,
        PF: 30,
        C: 40,
        B1: 48,
        B2: 16,
        B3: 18,
      },
      closing: ["PG", "SG", "SF", "PF", "C"],
    };
    const slots = ["PG", "SG", "B1"] as const;
    for (const other of f.teams.slice(1, 5)) {
      const incoming = [other.roster.PG!, other.roster.C!, other.roster.B2!];
      const exchanged = exchangePackage(
        f.teams,
        0,
        other.id,
        slots.map((slot) => f.teams[0].roster[slot]!),
        incoming,
      )[0];
      const actual = evaluateTeam(exchanged).score;
      for (const first of incoming)
        for (const second of incoming.filter((id) => id !== first)) {
          const third = incoming.find((id) => id !== first && id !== second)!;
          const candidate = {
            ...exchanged,
            roster: { ...exchanged.roster, PG: first, SG: second, B1: third },
          };
          expect(actual).toBeGreaterThanOrEqual(
            evaluateTeam(candidate).score - 1e-9,
          );
        }
    }
  });

  it("evaluates newly hired offseason coaches without overwriting the completed season coach", () => {
    const f = modernFixture().franchise!;
    f.coachOffice = {
      version: 1,
      years: [
        {
          year: 1,
          baseline: f.teams.map((team) => team.coach?.id ?? null),
          changes: [
            {
              teamId: 1,
              from: "brock",
              to: "misty",
              source: "user",
              reason: "New coach",
            },
          ],
          cpuProcessed: false,
        },
      ],
    };
    const offer = {
      teamId: 1,
      giveIds: [149],
      receiveIds: [f.teams[1].roster.B3!],
    };
    const coached = projectedCoaches(f.teams, f.coachOffice, f.year);
    const traded = exchangePackage(
      coached,
      0,
      1,
      offer.giveIds,
      offer.receiveIds,
    );
    const expected = compareTeamEvaluation(coached[1], traded[1]);
    const evaluation = evaluateTradePackage(f, offer);
    expect(evaluation.partnerBefore).toBeCloseTo(expected.before);
    expect(evaluation.partnerAfter).toBeCloseTo(expected.after);
    expect(f.teams[1].coach?.id).toBe("brock");
  });

  it("reports the same complete-roster trade delta and factors as the shared evaluator", () => {
    const f = modernFixture().franchise!;
    const offer = {
      teamId: 1,
      giveIds: [149],
      receiveIds: [f.teams[1].roster.B3!],
    };
    const traded = exchangePackage(
      f.teams,
      0,
      1,
      offer.giveIds,
      offer.receiveIds,
    );
    const expected = compareTeamEvaluation(f.teams[1], traded[1]);
    const actual = evaluateTradePackage(f, offer);
    expect(actual.partnerBefore).toBeCloseTo(expected.before);
    expect(actual.partnerAfter).toBeCloseTo(expected.after);
    expect(actual.userDelta).toBeCloseTo(
      compareTeamEvaluation(f.teams[0], traded[0]).delta,
    );
    for (const factor of expected.factors)
      expect(actual.factors).toContainEqual(factor);
    expect(actual.score).toBeCloseTo(
      actual.factors.reduce((sum, factor) => sum + factor.contribution, 0),
    );
  });

  it("refreshes trade value after a coach or developed skill changes while retaining talent floors", () => {
    const f = modernFixture().franchise!;
    const offer = {
      teamId: 1,
      giveIds: [149],
      receiveIds: [f.teams[1].roster.B3!],
    };
    const first = evaluateTradePackage(f, offer);
    f.teams[1].coach = { version: 1, id: "misty" };
    const coached = evaluateTradePackage(f, offer);
    expect(coached.outgoingValue).toBe(first.outgoingValue);
    expect(
      coached.factors.find((factor) => factor.label === "Coach and scheme fit")
        ?.contribution,
    ).not.toBe(
      first.factors.find((factor) => factor.label === "Coach and scheme fit")
        ?.contribution,
    );
    f.teams[0].development = { 149: { threePoint: 18, passing: 12 } };
    const developed = evaluateTradePackage(f, offer);
    expect(developed.outgoingValue).toBeGreaterThan(coached.outgoingValue);
    expect(
      evaluateTradePackage(f, {
        ...offer,
        giveIds: [129],
        receiveIds: [f.teams[1].roster.PG!],
      }).accepted,
    ).toBe(false);
  });

  it("uses the shared delta for free-agent previews including incoming development", () => {
    const f = marketFixture().franchise!;
    const id = freeAgentMarket(f)[0].pokemonId;
    const fresh = {
      ...f,
      offseasons: [
        {
          ...f.offseasons![0],
          players: [
            {
              pokemonId: id,
              teamId: 1,
              before: 50,
              after: 55,
              minutesPerGame: 20,
              impactPer36: 15,
              changes: { passing: 10, threePoint: 12 },
              outcome: "growth" as const,
              reasons: [],
            },
          ],
        },
      ],
    };
    const agent = freeAgentMarket(fresh).find(
      (agent) => agent.pokemonId === id,
    )!;
    fresh.coachOffice = {
      version: 1,
      years: [
        {
          year: 1,
          baseline: fresh.teams.map((team) => team.coach?.id ?? null),
          changes: [
            {
              teamId: 0,
              from: "brock",
              to: "misty",
              source: "user",
              reason: "New coach",
            },
          ],
          cpuProcessed: false,
        },
      ],
    };
    const team = projectedCoaches(fresh.teams, fresh.coachOffice, 1)[0],
      next = replacement(team, "PG", id, agent.development);
    const expected = compareTeamEvaluation(team, next);
    const actual = evaluateFreeAgentSigning(fresh, 0, id, team.roster.PG!);
    expect(actual.eligible).toBe(true);
    expect(actual.score).toBeCloseTo(expected.delta);
    expect(actual.teamBefore).toBeCloseTo(expected.before);
    expect(actual.teamAfter).toBeCloseTo(expected.after);
    expect(actual.reason).toContain("Shared team value");
  });

  it("ranks every eligible rookie replacement by complete developed roster value", () => {
    const f = modernFixture().franchise!;
    f.teams[0].development = {
      129: { passing: 18, threePoint: 18, ballHandling: 18 },
    };
    const choices = [252, 254, 282, 289, 376];
    f.coachOffice = {
      version: 1,
      years: [
        {
          year: 1,
          baseline: f.teams.map((team) => team.coach?.id ?? null),
          changes: [
            {
              teamId: 0,
              from: "brock",
              to: "misty",
              source: "user",
              reason: "New coach",
            },
          ],
          cpuProcessed: false,
        },
      ],
    };
    const projected = projectedCoaches(f.teams, f.coachOffice, 1)[0];
    f.history[0].rosters.push(
      ROOKIE_POKEMON.filter(
        (mon) => mon.generation === 3 && !choices.includes(mon.id),
      ).map((mon) => mon.id),
    );
    const options = choices
      .flatMap((id) =>
        ROSTER_SLOTS.map((slot) => ({
          pokemonId: id,
          releasedId: f.teams[0].roster[slot]!,
          delta: compareTeamEvaluation(
            projected,
            replacement(projected, slot, id),
          ).delta,
        })),
      )
      .sort(
        (a, b) =>
          b.delta - a.delta ||
          a.pokemonId - b.pokemonId ||
          a.releasedId - b.releasedId,
      );
    const pick = recommendedRookiePick(f, 0, false)!;
    expect(pick).toMatchObject({
      pokemonId: options[0].pokemonId,
      releasedId: options[0].releasedId,
    });
    expect(pick.reason).toContain("Shared team value");
  });

  it("ranks accepted suggestions by shared team improvement", () => {
    const f = modernFixture().franchise!;
    const suggestions = suggestTrades(f, {
      teamId: 1,
      giveIds: [149],
      limit: 8,
    });
    expect(suggestions.length).toBeGreaterThan(0);
    for (const suggestion of suggestions) {
      const next = exchangePackage(
        f.teams,
        0,
        1,
        suggestion.offer.giveIds,
        suggestion.offer.receiveIds,
      );
      expect(suggestion.rank).toBeCloseTo(
        compareTeamEvaluation(f.teams[0], next[0]).delta,
      );
    }
  });

  it("only makes CPU waiver changes that improve the shared objective and preserve unique rosters", () => {
    const state = marketFixture(),
      f = state.franchise!;
    const team = f.teams[1];
    const best = freeAgentMarket(f)
      .flatMap((agent) =>
        ROSTER_SLOTS.map((slot) => ({
          pokemonId: agent.pokemonId,
          releasedId: team.roster[slot]!,
          score: compareTeamEvaluation(
            team,
            replacement(team, slot, agent.pokemonId, agent.development),
          ).delta,
        })),
      )
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.pokemonId - b.pokemonId ||
          a.releasedId - b.releasedId,
      )[0];
    const next = processCpuFreeAgency(state).franchise!;
    expect(next.freeAgency!.transactions.length).toBeGreaterThan(0);
    expect(next.freeAgency!.transactions[0]).toMatchObject({
      teamId: 1,
      pokemonId: best.pokemonId,
      releasedId: best.releasedId,
    });
    expect(
      new Set(next.teams.flatMap((team) => Object.values(team.roster))).size,
    ).toBe(240);
    for (const signing of next.freeAgency!.transactions) {
      expect(signing.reason).toContain("Shared team value");
      expect(evaluateTeam(next.teams[signing.teamId]).score).toBeGreaterThan(
        evaluateTeam(f.teams[signing.teamId]).score,
      );
    }
  });

  it("executes modern CPU packages only when both shared roster comparisons improve", () => {
    const f = modernFixture().franchise!;
    f.teams = exchangePlayers(
      f.teams,
      1,
      2,
      f.teams[1].roster.PG!,
      f.teams[2].roster.C!,
    );
    const result = cpuMarketTrades(f, 2);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(
      new Set(result.teams.flatMap((team) => Object.values(team.roster))).size,
    ).toBe(240);
    for (const trade of result.trades) {
      expect(trade.reason).toContain("shared team value");
      for (const id of [trade.fromTeamId!, trade.teamId])
        expect(
          compareTeamEvaluation(f.teams[id], result.teams[id]).delta,
        ).toBeGreaterThan(0);
    }
  });
});
