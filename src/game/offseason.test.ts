import { retainMorale } from "./playerMorale";
import { retainChemistry } from "./teammateChemistry";
import { retainMastery } from "./abilityMastery";
import { compareTeamEvaluation } from "./teamEvaluation";
import { exchangePlayers } from "./rosterTrades";
import { beforeAll, describe, expect, it } from "vitest";
import { POKEMON_BY_ID } from "../data/pokemon";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { leaguePlayers } from "./leagueStats";
import { loadGame, prepareGameLoad } from "./persistence";
import { simulatePlayoffs } from "./playoffs";
import { enterOffseason, applyTrade, evaluateTrade } from "./franchise";
import { developPlayer, processOffseason } from "./offseason";
import { DEVELOPMENT_SKILLS } from "./developmentTypes";
import { attributes, teamRatings } from "./ratings";
import { gameReducer, initialState } from "./state";
import {
  ROSTER_SLOTS,
  type GameState,
  type LeaguePlayer,
  type Run,
} from "./types";
const run = (): Run => ({
  ...createRun("free", true, 47),
  // This suite exercises the historical model-2 development capsule.
  movesetVersion: undefined,
  abilityMasteryVersion: undefined,
  chemistryGrowthVersion: undefined,
  moraleVersion: undefined,
  personalityVersion: undefined,
  roster: Object.fromEntries(
    ROSTER_SLOTS.map((s, i) => [s, [65, 150, 149, 68, 143, 9, 94, 59][i]]),
  ) as Run["roster"],
});
const player = (): LeaguePlayer => ({
  ...leaguePlayers(createLeague(run()))[0],
  gamesPlayed: 82,
  minutes: 2460,
  points: 1800,
  assists: 500,
  offensiveRebounds: 50,
  defensiveRebounds: 350,
  steals: 100,
  blocks: 30,
  turnovers: 180,
  fga: 1400,
  fgm: 650,
  ftm: 300,
  fta: 360,
  threePM: 200,
  threePA: 520,
  rimFga: 500,
  rimFgm: 290,
  midFga: 380,
  midFgm: 160,
});
const sum = (p: ReturnType<typeof developPlayer>) =>
  Object.values(p.changes).reduce((s, n) => s + n, 0);
describe("volatile player development", () => {
  it("normalizes season impact to 36 minutes without dividing by games twice", () => {
    const p = player();
    const report = developPlayer(p, {}, 1, 471);
    expect(report.impactPer36).toBe(41.4);
    const half = { ...p };
    for (const key of [
      "gamesPlayed",
      "minutes",
      "points",
      "assists",
      "offensiveRebounds",
      "defensiveRebounds",
      "steals",
      "blocks",
      "turnovers",
      "fga",
      "fgm",
      "ftm",
      "fta",
      "threePM",
      "threePA",
      "rimFga",
      "rimFgm",
      "midFga",
      "midFgm",
    ] as const)
      half[key] /= 2;
    const shorter = developPlayer(half, {}, 1, 471);
    expect(shorter.impactPer36).toBe(report.impactPer36);
    expect(shorter.changes).toEqual(report.changes);
  });
  it("changes actual skills reproducibly without mutating source data", () => {
    const p = player(),
      before = structuredClone(p),
      factual = structuredClone(POKEMON_BY_ID.get(p.pokemonId));
    const a = developPlayer(p, {}, 1, 471);
    expect(Object.keys(a.changes).length).toBeGreaterThan(0);
    expect(developPlayer(p, {}, 1, 471)).toEqual(a);
    expect(p).toEqual(before);
    expect(POKEMON_BY_ID.get(p.pokemonId)).toEqual(factual);
    expect(a.reasons.length).toBeGreaterThan(1);
  });
  it("rewards opportunity and productive play when the random form is held constant", () => {
    const p = player();
    const limited = {
      ...p,
      minutes: 410,
      points: 300,
      assists: 83,
      offensiveRebounds: 8,
      defensiveRebounds: 58,
      steals: 17,
      blocks: 5,
      turnovers: 30,
      fga: 233,
      fgm: 108,
      ftm: 50,
      fta: 60,
      threePM: 33,
      threePA: 87,
      rimFgm: 48,
      rimFga: 83,
      midFgm: 27,
      midFga: 63,
    };
    expect(sum(developPlayer(p, {}, 1, 471))).toBeGreaterThan(
      sum(developPlayer(limited, {}, 1, 471)),
    );
    expect(
      sum(
        developPlayer(
          { ...p, points: 2500, assists: 800, turnovers: 80 },
          {},
          1,
          471,
        ),
      ),
    ).toBeGreaterThan(
      sum(
        developPlayer(
          { ...p, points: 700, assists: 100, turnovers: 400 },
          {},
          1,
          471,
        ),
      ),
    );
  });
  it("has frequent large gains and declines across seeded seasons, inside all bounds", () => {
    const p = player(),
      reports = Array.from({ length: 50 }, (_, seed) =>
        developPlayer(p, {}, 1, seed),
      );
    expect(
      reports.filter((r) => r.after - r.before >= 3).length,
    ).toBeGreaterThan(8);
    expect(
      reports.filter((r) => r.after - r.before <= -3).length,
    ).toBeGreaterThan(8);
    for (const report of reports)
      for (const change of Object.values(report.changes)) {
        expect(Number.isInteger(change)).toBe(true);
        expect(change).toBeGreaterThanOrEqual(-10);
        expect(change).toBeLessThanOrEqual(12);
      }
    for (const bound of [-30, 30]) {
      const previous = Object.fromEntries(
        DEVELOPMENT_SKILLS.map((k) => [k, bound]),
      );
      const report = developPlayer(p, previous, 8, 123);
      const next = { ...previous };
      for (const k of DEVELOPMENT_SKILLS) {
        next[k] += report.changes[k] ?? 0;
        expect(next[k]).toBeGreaterThanOrEqual(-30);
        expect(next[k]).toBeLessThanOrEqual(30);
      }
      for (const value of Object.values(
        attributes(POKEMON_BY_ID.get(p.pokemonId)!, next),
      )) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    }
  });
});
let offseason: GameState;
beforeAll(() => {
  const r = run(),
    simulated = gameReducer(
      { ...initialState(47), run: r },
      { type: "SIMULATE" },
    );
  const state = {
    ...simulated,
    run: {
      ...simulated.run,
      playoffs: simulatePlayoffs(simulated.run.result!.league!, r.seasonSeed),
    },
  };
  offseason = enterOffseason(state);
}, 600000);
describe("the league offseason", () => {
  it("round trips real development and CPU trades across two completed seasons", async () => {
    const first = processOffseason(offseason);
    const memory = (state: GameState) => ({
      getItem: () => JSON.stringify(state),
      setItem: () => {},
    });
    const restored = loadGame(memory(first), 999);
    expect(restored.notice).toBeNull();
    expect(restored.state).toEqual(first);
    const ready = gameReducer(restored.state, {
      type: "START_FRANCHISE_SEASON",
      seed: 88,
    });
    expect(loadGame(memory(ready), 999).state).toEqual(ready);
    const coached = gameReducer(ready, { type: "SELECT_COACH", id: "mom" });
    const played = gameReducer(coached, { type: "SIMULATE" });
    expect(played.run.result!.modelVersion).toBe(6);
    const completed = {
      ...played,
      run: {
        ...played.run,
        playoffs: simulatePlayoffs(
          played.run.result!.league!,
          played.run.seasonSeed,
        ),
      },
    };
    const second = gameReducer(completed, { type: "ENTER_OFFSEASON" });
    expect(second.franchise!.offseasons!.map((r) => r.year)).toEqual([1, 2]);
    expect(second.franchise!.offseasons![0]).toEqual(
      first.franchise!.offseasons![0],
    );
    expect(second.franchise!.history[0]).toEqual(ready.franchise!.history[0]);
    expect(second.franchise!.history[0]).toMatchObject(
      first.franchise!.history[0],
    );
    const previous = new Map(
      first.franchise!.offseasons![0].players.map((p) => [
        p.pokemonId,
        p.after,
      ]),
    );
    for (const player of second.franchise!.offseasons![1].players)
      expect(player.before).toBe(previous.get(player.pokemonId));
    const pending = prepareGameLoad(memory(second), 999);
    expect(pending.restore).toBeDefined();
    const loaded = await pending.restore!(
      () => {},
      new AbortController().signal,
    );
    expect(loaded.notice).toBeNull();
    expect(loaded.state).toEqual(second);
    expect(gameReducer(loaded.state, { type: "PROCESS_OFFSEASON" })).toBe(
      loaded.state,
    );
  }, 600000); // Two seasons and four save restores, including archived replays.
  it("processes every species once and preserves the completed season and careers", () => {
    const before = structuredClone(offseason),
      after = processOffseason(offseason),
      f = after.franchise!;
    expect(f.modelVersion).toBe(2);
    expect(f.offseasons).toHaveLength(1);
    expect(f.offseasons![0].players).toHaveLength(240);
    expect(new Set(f.offseasons![0].players.map((p) => p.pokemonId)).size).toBe(
      240,
    );
    expect(after.run).toEqual(before.run);
    expect(f.history).toEqual(before.franchise!.history);
    expect(f.careers).toEqual(before.franchise!.careers);
    expect(offseason).toEqual(before);
    expect(processOffseason(after)).toBe(after);
    expect(processOffseason(offseason)).toEqual(after);
  });
  it("makes only mutually beneficial CPU trades without touching the user's roster", () => {
    const after = processOffseason(offseason),
      f = after.franchise!;
    expect(f.trades.length).toBeGreaterThan(0);
    expect(f.trades.length).toBeLessThanOrEqual(6);
    expect(f.teams[0].roster).toEqual(offseason.franchise!.teams[0].roster);
    const ids = f.teams.flatMap((t) => Object.values(t.roster));
    expect(new Set(ids).size).toBe(240);
    const used = new Set<number>();
    for (const trade of f.trades) {
      expect(trade.source).toBe("cpu");
      expect(trade.fromTeamId).toBeGreaterThan(0);
      expect(trade.teamId).toBeGreaterThan(0);
      expect(used.has(trade.fromTeamId!)).toBe(false);
      expect(used.has(trade.teamId)).toBe(false);
      used.add(trade.fromTeamId!);
      used.add(trade.teamId);
      const a = f.teams[trade.fromTeamId!],
        b = f.teams[trade.teamId];
      // Trades are disjoint, so reverse this exchange to recover both
      // developed rosters and evaluate the actual shared-value policy.
      const before = exchangePlayers(
        f.teams,
        trade.fromTeamId!,
        trade.teamId,
        trade.receiveId,
        trade.giveId,
      );
      const aGain = compareTeamEvaluation(before[a.id], a).delta,
        bGain = compareTeamEvaluation(before[b.id], b).delta;
      expect(aGain).toBeGreaterThanOrEqual(0.05);
      expect(bGain).toBeGreaterThanOrEqual(0.05);
      expect(aGain + bGain).toBeGreaterThanOrEqual(0.15);
      expect(trade.reason).toBeTruthy();
    }
    for (const team of f.teams)
      expect(
        Object.keys(team.development!)
          .map(Number)
          .sort((a, b) => a - b),
      ).toEqual(Object.values(team.roster).sort((a, b) => a! - b!));
  });
  it("runs through reducer entry and freezes developed rosters for the next season", () => {
    const entered = gameReducer(
      { ...offseason, franchise: undefined },
      { type: "ENTER_OFFSEASON" },
    );
    expect(entered.franchise!.offseasons).toHaveLength(1);
    const next = gameReducer(entered, {
      type: "START_FRANCHISE_SEASON",
      seed: 88,
    });
    expect(next.run.leagueTeams).toEqual(
      entered
        .franchise!.teams.map(retainChemistry)
        .map(retainMorale)
        .map(retainMastery)
        .map((team) => ({
          ...team,
          personalityVersion: 1 as const,
          movesetVersion: 3 as const,
        })),
    );
    expect(next.franchise!.year).toBe(2);
    expect(next.run.result).toBeNull();
    expect(processOffseason(next)).toBe(next);
  });
  it("keeps developed skills with a player in a later user trade", () => {
    const state = processOffseason(offseason),
      f = state.franchise!;
    const all = Object.assign({}, ...f.teams.map((t) => t.development));
    let offer: { teamId: number; give: number; receive: number } | undefined;
    for (const team of f.teams.slice(1))
      for (const give of Object.values(f.teams[0].roster))
        for (const receive of Object.values(team.roster)) {
          if (!offer && evaluateTrade(f, team.id, give!, receive!).accepted)
            offer = { teamId: team.id, give: give!, receive: receive! };
        }
    expect(offer).toBeDefined();
    const { teamId, give, receive } = offer!;
    const after = applyTrade(state, teamId, give, receive).franchise!;
    expect(after.teams[0].development![receive]).toEqual(all[receive]);
    expect(after.teams[teamId].development![give]).toEqual(all[give]);
    expect(after.teams[0].development![give]).toBeUndefined();
    expect(after.teams[teamId].development![receive]).toBeUndefined();
    expect(after.careers).toEqual(f.careers);
  });
});
