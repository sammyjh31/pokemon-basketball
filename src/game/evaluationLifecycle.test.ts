import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { validateLeagueTeams } from "./franchiseValidation";
import { archivedSeasonRun } from "./archive";
import { initialState } from "./state";
import { loadGame, saveGame } from "./persistence";
import { startFranchiseSeason, evaluateTrade } from "./franchise";
import { evaluateTradePackage } from "./tradeMarket";
import { rookieFixture } from "./rookieDraft.testUtils";
import type { FranchiseSeason } from "./franchiseTypes";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { ROSTER_SLOTS } from "./types";

const run = () => ({
  ...createRun("free", true, 22),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
it("opts new solo and local clubs into one evaluation version, rejecting mixed and unknown flags", () => {
  const r = run(),
    teams = createLeague(r);
  expect(r.evaluationVersion).toBe(1);
  expect(
    validateLeagueTeams(teams, true).every((t) => t.evaluationVersion === 1),
  ).toBe(true);
  const mixed = structuredClone(teams);
  delete mixed[1].evaluationVersion;
  expect(() => validateLeagueTeams(mixed, true)).toThrow();
  expect(() =>
    validateLeagueTeams(
      teams.map((t) => ({ ...t, evaluationVersion: 2 })),
      true,
    ),
  ).toThrow();
  const draft = local.createLocalLeague(
    [
      { name: "A", teamId: 0 },
      { name: "B", teamId: 1 },
    ],
    true,
    22,
  );
  expect(draft.evaluationVersion).toBe(1);
  expect(local.parseLocalLeague(JSON.stringify(draft)).evaluationVersion).toBe(
    1,
  );
  delete draft.evaluationVersion;
  expect(
    local.parseLocalLeague(JSON.stringify(draft)).evaluationVersion,
  ).toBeUndefined();
  expect(() =>
    local.parseLocalLeague(JSON.stringify({ ...draft, evaluationVersion: 2 })),
  ).toThrow();
});
it("preserves absent evaluation flags through saves and archives and rejects invalid saved versions", () => {
  let value = "";
  const storage = {
    getItem: () => value || null,
    setItem: (_k: string, v: string) => {
      value = v;
    },
    removeItem: () => {
      value = "";
    },
  };
  for (const version of [1, undefined] as const) {
    const r = { ...run(), evaluationVersion: version };
    saveGame(storage, { ...initialState(22), run: r });
    expect(loadGame(storage, 22).state.run.evaluationVersion).toBe(version);
    const season = {
      seasonSeed: 22,
      replay: { teams: createLeague(r), seasonModel: 4 },
    } as FranchiseSeason;
    expect(archivedSeasonRun(season).evaluationVersion).toBe(version);
  }
  const bad = JSON.parse(value);
  bad.run.evaluationVersion = 2;
  value = JSON.stringify(bad);
  expect(loadGame(storage, 22).notice).toBeTruthy();
});
it("adopts evaluation only at the next solo franchise boundary", () => {
  const state = rookieFixture();
  delete state.run.evaluationVersion;
  state.franchise!.teams.forEach((t) => delete t.evaluationVersion);
  const before = JSON.stringify(state),
    next = startFranchiseSeason(state, 988);
  expect(next.run.evaluationVersion).toBe(1);
  expect(next.franchise!.teams.every((t) => t.evaluationVersion === 1)).toBe(
    true,
  );
  expect(JSON.stringify(state)).toBe(before);
});
it("restores historical local evaluation per season without rewriting the original draft", () => {
  let draft = local.createLocalLeague(
    [
      { name: "A", teamId: 0 },
      { name: "B", teamId: 1 },
    ],
    true,
    601,
    2,
    {
      mode: "full-pool",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: true,
        adaptiveCoaching: true,
        familiarity: 0,
      },
    },
  );
  delete draft.evaluationVersion;
  while (local.currentLocalTurn(draft)) {
    draft = local.advanceLocalCpu(draft);
    const turn = local.currentLocalTurn(draft);
    if (!turn) break;
    const id = local
      .localLeaguePool(draft)
      .find((p) => !draft.picks.some((x) => x.pokemonId === p.id))!.id;
    const slot = ROSTER_SLOTS.find(
      (s) => !draft.picks.some((p) => p.teamId === turn.teamId && p.slot === s),
    )!;
    draft = local.pickLocalPlayer(draft, id, slot);
  }
  const finish = (d: local.LocalLeague) => {
    const result = simulateLocalSeason(d),
      playoffs = simulatePlayoffs(result.league!, career.localSeasonSeed(d));
    return career.beginLocalOffseason(
      { ...d, completed: true, playoffGames: playoffGameCount(playoffs) },
      result,
      playoffs,
    );
  };
  const old = finish(draft),
    archived = structuredClone(old.career!.history);
  const restored = local.parseLocalLeague(JSON.stringify(old));
  expect(
    restored.career!.teams.every((t) => t.evaluationVersion === undefined),
  ).toBe(true);
  const next = career.startNextLocalSeason(restored);
  expect(next.evaluationVersion).toBeUndefined();
  expect(local.localLeagueRun(next).evaluationVersion).toBe(1);
  expect(next.career!.history).toEqual(archived);
  expect(
    local
      .parseLocalLeague(JSON.stringify(next))
      .career!.teams.every((t) => t.evaluationVersion === 1),
  ).toBe(true);
  const historicSecond = structuredClone(next);
  historicSecond.career!.teams.forEach((t) => delete t.evaluationVersion);
  expect(
    local
      .parseLocalLeague(JSON.stringify(historicSecond))
      .career!.teams.every((t) => t.evaluationVersion === undefined),
  ).toBe(true);
  const second = finish(next);
  expect(
    local.parseLocalLeague(JSON.stringify(second)).career!.history,
  ).toEqual(second.career!.history);
  const mixed = structuredClone(second);
  delete mixed.career!.teams[1].evaluationVersion;
  expect(() => local.parseLocalLeague(JSON.stringify(mixed))).toThrow();
}, 30000);

it("routes the original single-player trade API through the modern package safeguards", () => {
  const f = rookieFixture().franchise!;
  f.teams.forEach((team) => {
    team.evaluationVersion = 1;
  });
  const give = f.teams[0].roster.PG!,
    receive = f.teams[1].roster.C!;
  expect(evaluateTrade(f, 1, give, receive)).toEqual(
    evaluateTradePackage(f, {
      teamId: 1,
      giveIds: [give],
      receiveIds: [receive],
    }),
  );
});
