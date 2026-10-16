import { expect, it } from "vitest";
import { rookieFixture } from "./rookieDraft.testUtils";
import {
  beginRookieDraft,
  selectRookie,
  recommendedRookiePick,
} from "./rookieDraft";
import {
  clubTradeProfile,
  cpuMarketTrades,
  evaluateTradePackage,
} from "./tradeMarket";
import type { Franchise } from "./franchiseTypes";
import type { RivalScouting } from "./rivalScoutingTypes";
function learned(): Franchise {
  const f = rookieFixture().franchise!;
  const teams: RivalScouting["teams"] = {};
  for (const club of f.teams) {
    const rival = f.teams[(club.id + 2) % 30];
    teams[club.id] = [
      {
        teamId: rival.id,
        games: 8,
        losses: 8,
        playoffGames: 4,
        threats: [
          {
            pokemonId: rival.roster.PG!,
            attempts: 100,
            points: 200,
            rimAttempts: 50,
            threeAttempts: 50,
          },
        ],
      },
    ];
  }
  f.history[0].rivalScouting = { version: 1, teams };
  return f;
}
it("uses learned rival coverage in rookie recommendations and explains the target", () => {
  const f = learned(),
    pick = recommendedRookiePick(f, 0, false)!;
  expect(pick.reason).toContain(f.teams[2].name);
  expect(Number.isFinite(pick.rivalGain)).toBe(true);
  expect(Math.abs(pick.rivalGain!)).toBeLessThanOrEqual(3);
  expect(recommendedRookiePick(f, 0, false)).toEqual(pick);
});
it("values both clubs' rival coverage in a trade while retaining ability and rotation factors", () => {
  const f = learned();
  const offer = {
    teamId: 1,
    giveIds: [f.teams[0].roster.B1!],
    receiveIds: [f.teams[1].roster.B1!],
  };
  const result = evaluateTradePackage(f, offer);
  expect(result.factors.map((x) => x.label)).toContain("Rival coverage");
  expect(result.factors.map((x) => x.label)).toContain("Player ability");
  expect(Number.isFinite(result.userRivalGain)).toBe(true);
  expect(Number.isFinite(result.rivalGain)).toBe(true);
  expect(clubTradeProfile(f, 1).reason).toContain(f.teams[3].name);
});
it("keeps legacy recommendations and trade factor lists free of invented scouting", () => {
  const f = rookieFixture().franchise!;
  expect(recommendedRookiePick(f, 0, false)).not.toHaveProperty("reason");
  expect(
    evaluateTradePackage(f, {
      teamId: 1,
      giveIds: [f.teams[0].roster.B1!],
      receiveIds: [f.teams[1].roster.B1!],
    }).factors.map((x) => x.label),
  ).not.toContain("Rival coverage");
});

it("changes a CPU rookie selection when a comparable prospect covers its learned rival", () => {
  const oldState = rookieFixture(),
    newState = { ...oldState, franchise: learned() };
  const oldStart = beginRookieDraft(oldState),
    newStart = beginRookieDraft(newState);
  const pick = recommendedRookiePick(oldStart.franchise!, 0, false)!;
  const oldDone = selectRookie(oldStart, pick.pokemonId, pick.releasedId),
    newDone = selectRookie(newStart, pick.pokemonId, pick.releasedId);
  const previous = oldDone.franchise!.rookieDrafts![0].picks[15],
    current = newDone.franchise!.rookieDrafts![0].picks[15];
  expect(previous).toMatchObject({
    teamId: 15,
    pokemonId: 369,
    releasedId: 41,
  });
  expect(current).toMatchObject({ teamId: 15, pokemonId: 344, releasedId: 41 });
  expect(
    new Set(newDone.franchise!.teams.flatMap((t) => Object.values(t.roster)))
      .size,
  ).toBe(240);
});
it("declines a marginal deal that would remove useful coverage and still protects talent floors", () => {
  const original = rookieFixture().franchise!,
    f = learned();
  const offer = { teamId: 2, giveIds: [68], receiveIds: [123] };
  expect(evaluateTradePackage(original, offer).accepted).toBe(true);
  const counterAware = evaluateTradePackage(f, offer);
  expect(counterAware.accepted).toBe(false);
  expect(counterAware.rivalGain).toBeLessThan(0);
  const weak = evaluateTradePackage(f, {
    teamId: 2,
    giveIds: [129],
    receiveIds: [123],
  });
  expect(weak.accepted).toBe(false);
  expect(weak.reason).toContain("ability floor");
});
it("lets CPU clubs initiate mutually useful counter trades deterministically", () => {
  const original = rookieFixture().franchise!,
    f = learned(),
    before = structuredClone(f);
  expect(cpuMarketTrades(original).trades).toHaveLength(0);
  const result = cpuMarketTrades(f);
  expect(result.trades.length).toBeGreaterThan(0);
  expect(cpuMarketTrades(f)).toEqual(result);
  expect(f).toEqual(before);
  for (const trade of result.trades) {
    const from = trade.fromTeamId!,
      give = trade.giveIds!,
      receive = trade.receiveIds!;
    const a = evaluateTradePackage(
      f,
      { teamId: trade.teamId, giveIds: give, receiveIds: receive },
      from,
    );
    const b = evaluateTradePackage(
      f,
      { teamId: from, giveIds: receive, receiveIds: give },
      trade.teamId,
    );
    expect(a.accepted && b.accepted).toBe(true);
    expect(a.userDelta + 0.25 * (a.userRivalGain ?? 0)).toBeGreaterThanOrEqual(
      0.03,
    );
    expect(b.userDelta + 0.25 * (b.userRivalGain ?? 0)).toBeGreaterThanOrEqual(
      0.03,
    );
    expect(trade.reason).toContain("Rival coverage");
  }
  expect(
    new Set(result.teams.flatMap((t) => Object.values(t.roster))).size,
  ).toBe(240);
}, 15000);
