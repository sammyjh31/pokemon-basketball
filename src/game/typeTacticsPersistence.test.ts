import { beforeAll, describe, expect, it } from "vitest";
import { createRun, placePokemon } from "./draft";
import { createLeague } from "./league";
import { enterOffseason, startFranchiseSeason } from "./franchise";
import { validateLeagueTeams } from "./franchiseValidation";
import { loadGame } from "./persistence";
import { initialState } from "./state";
import {
  createLocalLeague,
  currentLocalTurn,
  localLeagueRun,
  localLeagueTeams,
  parseLocalLeague,
  pickLocalPlayer,
  type LocalLeague,
} from "./localLeague";
import {
  beginLocalOffseason,
  localSeasonSeed,
  startNextLocalSeason,
} from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { simulateSeason } from "./season";
import { ROSTER_SLOTS, type GameState, type LeagueTeam } from "./types";

function completedDraft() {
  let run = createRun("free", true, 42);
  [65, 135, 149, 68, 143, 121, 6, 131].forEach((id, i) => {
    run = placePokemon(run, id, ROSTER_SLOTS[i]);
  });
  return run;
}

function load(state: unknown) {
  return loadGame(
    { getItem: () => JSON.stringify(state), setItem: () => {} },
    99,
  );
}

function localDraft(): LocalLeague {
  let draft = createLocalLeague(
    [0, 1, 2, 3].map((teamId) => ({ name: `Coach ${teamId}`, teamId })),
    true,
    42,
    2,
    {
      mode: "full-pool",
      format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 1 },
      engineRules: {
        version: 1,
        abilities: false,
        adaptiveCoaching: false,
        familiarity: 0,
      },
    },
  );
  while (currentLocalTurn(draft)) {
    const turn = currentLocalTurn(draft)!;
    const slot = ROSTER_SLOTS.find(
      (slot) =>
        !draft.picks.some((p) => p.teamId === turn.teamId && p.slot === slot),
    )!;
    draft = pickLocalPlayer(draft, draft.picks.length + 1, slot);
  }
  return draft;
}

describe("versioned tactics creation and persistence", () => {
  let teams: LeagueTeam[];
  beforeAll(() => {
    teams = createLeague(completedDraft());
  });

  it("enables tactics on newly created runs and every drafted league team", () => {
    expect(createRun("free", true, 42).typeTacticsVersion).toBe(1);
    expect(teams.map((team) => team.typeTacticsVersion)).toEqual(
      Array(30).fill(1),
    );
    expect(
      validateLeagueTeams(teams, true).map((team) => team.typeTacticsVersion),
    ).toEqual(Array(30).fill(1));
  });

  it("round-trips new runs while preserving omitted flags in both older rulesets", () => {
    const current = initialState(42);
    expect(load(current).state.run.typeTacticsVersion).toBe(1);
    for (const typed of [false, true]) {
      const legacy = structuredClone(current);
      delete legacy.run.matchupVersion;
      delete legacy.run.typeTacticsVersion;
      if (!typed) delete legacy.run.typeMatchupsVersion;
      const restored = load(legacy);
      expect(restored.notice).toBeNull();
      expect(restored.state.run).toEqual(legacy.run);
      expect(Object.hasOwn(restored.state.run, "typeTacticsVersion")).toBe(
        false,
      );
    }
  });

  it.each([0, 2, -1, null, "1", true])(
    "rejects unsupported run tactics version %s",
    (version) => {
      const state = initialState(42);
      Object.assign(state.run, { typeTacticsVersion: version });
      expect(load(state).notice).not.toBeNull();
    },
  );

  it("rejects tactics without base type matchups", () => {
    const state = initialState(42);
    state.run.typeTacticsVersion = 1;
    delete state.run.typeMatchupsVersion;
    expect(load(state).notice).not.toBeNull();
    const invalid = structuredClone(teams);
    invalid.forEach((team) => {
      team.typeTacticsVersion = 1;
      delete team.typeMatchupsVersion;
    });
    expect(() => validateLeagueTeams(invalid, true)).toThrow();
  });

  it("rejects mixed or malformed league team versions without upgrading historical teams", () => {
    const legacy = structuredClone(teams);
    legacy.forEach((team) => {
      delete team.matchupVersion;
      delete team.typeTacticsVersion;
    });
    expect(
      validateLeagueTeams(legacy, true).every(
        (team) => !Object.hasOwn(team, "typeTacticsVersion"),
      ),
    ).toBe(true);
    const mixed = structuredClone(legacy);
    mixed[1].typeTacticsVersion = 1;
    expect(() => validateLeagueTeams(mixed, true)).toThrow();
    const malformed = structuredClone(legacy);
    malformed.forEach((team) => {
      Object.assign(team, { typeTacticsVersion: 2 });
    });
    expect(() => validateLeagueTeams(malformed, true)).toThrow();
  });

  it("enables tactics when a legacy franchise starts its next season, preserving its archive", () => {
    const run = completedDraft();
    delete run.matchupVersion;
    delete run.typeTacticsVersion;
    delete run.abilityMasteryVersion;
    delete run.chemistryGrowthVersion;
    delete run.moraleVersion;
    delete run.personalityVersion;
    const result = simulateSeason(run),
      playoffs = simulatePlayoffs(result.league!, run.seasonSeed);
    const finished: GameState = {
      ...initialState(42),
      run: { ...run, result, playoffs },
    };
    const offseason = enterOffseason(finished),
      saved = structuredClone(offseason);
    const next = startFranchiseSeason(offseason, 52);
    expect(next.franchise!.year).toBe(2);
    expect(next.run.typeTacticsVersion).toBe(1);
    expect(next.run.matchupVersion).toBe(1);
    expect(
      next.run.leagueTeams!.every((team) => team.matchupVersion === 1),
    ).toBe(true);
    // This legacy helper stores summary-only history. Preserve that absence
    // and the original season's team rules while upgrading the new season.
    expect(saved.franchise!.history[0].replay).toBeUndefined();
    expect(
      saved.run.result!.league!.teams.every(
        (team) => team.matchupVersion === undefined,
      ),
    ).toBe(true);
    expect(
      next.run.leagueTeams!.every((team) => team.typeTacticsVersion === 1),
    ).toBe(true);
    expect(
      next.franchise!.teams.every((team) => team.typeTacticsVersion === 1),
    ).toBe(true);
    expect(next.franchise!.history).toEqual(saved.franchise!.history);
    expect(offseason).toEqual(saved);
    expect(load(next).notice).toBeNull();
    const mixedRun = structuredClone(next);
    delete mixedRun.run.matchupVersion;
    delete mixedRun.run.typeTacticsVersion;
    expect(load(mixedRun).notice).not.toBeNull();
    const mixedFranchise = structuredClone(next);
    mixedFranchise.franchise!.teams.forEach((team) => {
      delete team.matchupVersion;
      delete team.typeTacticsVersion;
    });
    expect(load(mixedFranchise).notice).not.toBeNull();
  }, 300000);
});

describe("local tactics persistence", () => {
  it("propagates new rules through draft, teams and run while keeping the old model unchanged", () => {
    const draft = localDraft();
    expect(draft.typeTacticsVersion).toBe(1);
    expect(parseLocalLeague(JSON.stringify(draft)).typeTacticsVersion).toBe(1);
    expect(
      localLeagueTeams(draft).every((team) => team.typeTacticsVersion === 1),
    ).toBe(true);
    expect(localLeagueRun(draft).typeTacticsVersion).toBe(1);
    const oldModel = createLocalLeague(
      [
        { name: "A", teamId: 0 },
        { name: "B", teamId: 1 },
      ],
      true,
      42,
      1,
    );
    expect(Object.hasOwn(oldModel, "typeTacticsVersion")).toBe(false);
  });

  it("does not inject new flags while restoring or converting a legacy local draft", () => {
    for (const typed of [false, true]) {
      const legacy = localDraft();
      delete legacy.matchupVersion;
      delete legacy.typeTacticsVersion;
      if (!typed) delete legacy.typeMatchupsVersion;
      const restored = parseLocalLeague(JSON.stringify(legacy));
      expect(restored).toEqual(legacy);
      expect(Object.hasOwn(restored, "typeTacticsVersion")).toBe(false);
      const run = localLeagueRun(restored);
      expect(Object.hasOwn(run, "typeTacticsVersion")).toBe(false);
      expect(
        run.leagueTeams!.every(
          (team) => !Object.hasOwn(team, "typeTacticsVersion"),
        ),
      ).toBe(true);
    }
  });

  it.each([0, 2, -1, null, "1", true])(
    "rejects unsupported local tactics version %s",
    (version) => {
      const draft = localDraft();
      Object.assign(draft, { typeTacticsVersion: version });
      expect(() => parseLocalLeague(JSON.stringify(draft))).toThrow();
    },
  );

  it("rejects a local tactics flag without base type matchups", () => {
    const draft = localDraft();
    draft.typeTacticsVersion = 1;
    delete draft.typeMatchupsVersion;
    expect(() => parseLocalLeague(JSON.stringify(draft))).toThrow();
  });

  it.each([false, true])(
    "retains saved tactics rules (%s) across local career reloads and year two",
    (tactics) => {
      let draft = localDraft();
      if (!tactics) delete draft.matchupVersion;
      if (!tactics) delete draft.typeTacticsVersion;
      const result = simulateLocalSeason(draft),
        playoffs = simulatePlayoffs(result.league!, localSeasonSeed(draft));
      draft = beginLocalOffseason(
        { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
        result,
        playoffs,
      );
      const restored = parseLocalLeague(JSON.stringify(draft));
      const expected = tactics ? 1 : undefined;
      expect(restored.typeTacticsVersion).toBe(expected);
      expect(
        restored.career!.teams.every(
          (team) => team.typeTacticsVersion === expected,
        ),
      ).toBe(true);
      expect(
        restored.career!.history[0].teams.every(
          (team) => team.typeTacticsVersion === expected,
        ),
      ).toBe(true);
      const next = parseLocalLeague(
        JSON.stringify(startNextLocalSeason(restored)),
      );
      expect(
        next.career!.teams.every(
          (team) => team.typeTacticsVersion === expected,
        ),
      ).toBe(true);
      const mixed = structuredClone(draft);
      mixed.career!.teams[0].typeTacticsVersion = tactics ? undefined : 1;
      expect(() => parseLocalLeague(JSON.stringify(mixed))).toThrow();
      const mixedArchive = structuredClone(draft);
      mixedArchive.career!.history[0].teams[0].typeTacticsVersion = tactics
        ? undefined
        : 1;
      expect(() => parseLocalLeague(JSON.stringify(mixedArchive))).toThrow();
    },
  );
});
