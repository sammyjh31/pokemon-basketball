import { createHash } from "node:crypto";
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
import { freeAgentMarket, signFreeAgent } from "./freeAgency";
import { loadGame } from "./persistence";

/**
 * SHA-256 of saves produced by the release before CPU rules v1 (court rules v2
 * on main e255fb7, commit fce5470) for the exact steps below: a coached,
 * seed-47 season, offseason, full draft, three user signings and a trade
 * (offseason save), then the next season's start. These capsules also predate
 * ability mastery and league news: omit those new fields without altering any
 * recorded old rules, ratings, transactions or expected hashes.
 */
const BASE_OFFSEASON =
  "01d2d50fd0371c6547fd571f2f83d697d74eea0c871c849965bc8a20bde94f3b";
const BASE_SEASON =
  "26ccd5197862c428972164da424774bb9181348cc9515e1c92c8236062bbd10f";
const sha = (state: GameState) =>
  createHash("sha256").update(JSON.stringify(state)).digest("hex");
const restore = (state: GameState) =>
  loadGame({ getItem: () => JSON.stringify(state), setItem: () => {} }, 1);

/** Shared with the generator that ran on the previous release. */
export function legacyFranchise(): { offseason: GameState; season: GameState } {
  const initial = {
    ...initialState(47),
    run: {
      ...createRun("free", true, 47),
      abilityMasteryVersion: undefined,
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
  const archived = archiveFranchiseSeason({
    ...applied,
    run: {
      ...applied.run,
      playoffs: simulatePlayoffs(result.league!, initial.run.seasonSeed),
    },
  });
  // A franchise saved before CPU rules v1 has no rules record.
  delete (archived.franchise as { cpuRules?: unknown }).cpuRules;
  // The old release stored no derived news facts in its archive capsule.
  for (const history of archived.franchise!.history) delete history.newsGames;
  let s = beginRookieDraft(processOffseason(archived));
  while (!s.franchise!.rookieDrafts!.at(-1)!.complete) {
    const pick = recommendedRookiePick(s.franchise!, 0, true)!;
    s = selectRookie(s, pick.pokemonId, pick.releasedId);
  }
  for (const slot of ["B3", "B2", "B1"] as const)
    s = signFreeAgent(
      s,
      freeAgentMarket(s.franchise!)[0].pokemonId,
      s.franchise!.teams[0].roster[slot]!,
    );
  const suggestion = suggestTrades(s.franchise!, {
    packageSize: 1,
    limit: 1,
  })[0];
  const offseason = suggestion
    ? gameReducer(s, { type: "TRADE_PACKAGE", offer: suggestion.offer })
    : s;
  const season = gameReducer(offseason, {
    type: "START_FRANCHISE_SEASON",
    seed: 4747,
  });
  // Starting a season deliberately adopts current features in production. This
  // generator represents the pre-feature release, whose next year had neither
  // the mastery flag nor its initial zero-XP roster maps.
  delete season.run.abilityMasteryVersion;
  for (const team of [
    ...season.franchise!.teams,
    ...(season.run.leagueTeams ?? []),
  ]) {
    if (Object.values(team.abilityMastery ?? {}).some((xp) => xp !== 0))
      throw new Error("A historical fixture cannot discard earned mastery.");
    delete team.abilityMasteryVersion;
    delete team.abilityMastery;
  }
  return { offseason, season };
}

let offseason: GameState, season: GameState;
beforeAll(() => {
  ({ offseason, season } = legacyFranchise());
}, 1800000);

describe("franchises saved before CPU rules v1", () => {
  it("replay byte-identically to the previous release", () => {
    expect(offseason.franchise!.rookieDrafts![0].modelVersion).toBe(1);
    expect(sha(offseason)).toBe(BASE_OFFSEASON);
    expect(sha(season)).toBe(BASE_SEASON);
  });

  it(
    "load and validate unchanged, keeping their coaching",
    { timeout: 1800000 },
    () => {
      for (const saved of [offseason, season]) {
        const loaded = restore(saved);
        expect(loaded.notice).toBeNull();
        expect(loaded.state.franchise).toEqual(saved.franchise);
        expect(loaded.state.franchise!.cpuRules).toBeUndefined();
      }
      // The legacy CPU clubs kept their saved coaching into year two.
      expect(
        season.franchise!.teams.map((t) => [t.tactic, t.rotation, t.defense]),
      ).toEqual(
        offseason.franchise!.teams.map((t) => [
          t.tactic,
          t.rotation,
          t.defense,
        ]),
      );
    },
  );

  it(
    "adopt the rules when their next offseason begins, keeping earlier years",
    { timeout: 1800000 },
    () => {
      const result = simulateSeason(season.run),
        playoffs = simulatePlayoffs(result.league!, season.run.seasonSeed);
      const next = archiveFranchiseSeason({
        ...season,
        run: {
          ...season.run,
          result,
          playoffs,
          seasonProgress: {
            ...season.run.seasonProgress!,
            completedRounds: 82,
          },
        },
      });
      expect(next.franchise!.cpuRules).toEqual({ modelVersion: 1, since: 2 });
      const drafting = gameReducer(next, { type: "BEGIN_ROOKIE_DRAFT" });
      const drafts = drafting.franchise!.rookieDrafts!;
      expect(drafts.map((d) => d.modelVersion)).toEqual([1, 2]);
      expect(drafts[0]).toEqual(season.franchise!.rookieDrafts![0]);
      const loaded = restore(drafting);
      expect(loaded.notice).toBeNull();
      expect(loaded.state.franchise).toEqual(drafting.franchise);
    },
  );
});
