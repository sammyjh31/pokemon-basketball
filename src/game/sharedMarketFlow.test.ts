import { expect, it } from "vitest";
import { rookieFixture } from "./rookieDraft.testUtils";
import {
  beginRookieDraft,
  recommendedRookiePick,
  selectRookie,
} from "./rookieDraft";
import { processCpuFreeAgency, freeAgentMarket } from "./freeAgency";
import { suggestTrades } from "./tradeMarket";

it("completes a modern 60-pick draft, CPU waiver round and three-player trade suggestions", () => {
  let state = rookieFixture();
  state.run.evaluationVersion = 1;
  state.franchise!.teams = state.franchise!.teams.map((team) => ({
    ...team,
    evaluationVersion: 1,
  }));
  const started = performance.now();
  state = beginRookieDraft(state);
  while (!state.franchise!.rookieDrafts!.at(-1)!.complete) {
    const choice = recommendedRookiePick(state.franchise!, 0, false)!;
    state = selectRookie(state, choice.pokemonId, choice.releasedId);
  }
  const drafted = performance.now();
  console.log(
    JSON.stringify({
      stage: "modern 60-pick rookie draft",
      elapsedMs: drafted - started,
      picks: state.franchise!.rookieDrafts!.at(-1)!.picks.length,
    }),
  );
  expect(state.franchise!.rookieDrafts!.at(-1)!.picks).toHaveLength(60);
  expect(
    new Set(
      state.franchise!.teams.flatMap((team) => Object.values(team.roster)),
    ).size,
  ).toBe(240);
  const pool = freeAgentMarket(state.franchise!, false).length;
  state = processCpuFreeAgency(state);
  const signed = performance.now();
  console.log(
    JSON.stringify({
      stage: "modern CPU free agency",
      elapsedMs: signed - drafted,
      pool,
      signings: state.franchise!.freeAgency!.transactions.length,
    }),
  );
  const offers = suggestTrades(state.franchise!, { packageSize: 3 });
  console.log(
    JSON.stringify({
      stage: "modern 3-player suggestions",
      elapsedMs: performance.now() - signed,
      offers: offers.length,
    }),
  );
  expect(
    new Set(
      state.franchise!.teams.flatMap((team) => Object.values(team.roster)),
    ).size,
  ).toBe(240);
}, 60000);
