import { captureNewsGames, validateNewsGames } from "./archive";
import { ROSTER_SLOTS } from "./types";
import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { localSeasonBuilder } from "./localSeason";
import { resolveSeasonMatch } from "./season";
import {
  createPlayoffs,
  simulatePlayoffs,
  replayPlayoffs,
  playoffGameCount,
} from "./playoffs";
import { validateLeagueTeams } from "./franchiseValidation";
import { exchangePackage, exchangePlayers } from "./rosterTrades";
const fixture = () => ({
  ...createRun("free", true, 973),
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
const format = {
  teamCount: 4,
  gamesPerTeam: 14,
  playoffTeams: 4,
  bestOf: 1,
} as const;
describe("persistent ability mastery lifecycle", () => {
  it("freezes each fixture, awards actual games once and carries playoff banks", () => {
    const run = fixture(),
      teams = createLeague(run).slice(0, 4);
    expect(run.abilityMasteryVersion).toBe(1);
    expect(
      teams.every(
        (t) =>
          t.abilityMasteryVersion === 1 &&
          Object.keys(t.abilityMastery!).length === 8,
      ),
    ).toBe(true);
    const before = structuredClone(teams),
      job = localSeasonBuilder(teams, format, run.seasonSeed);
    job.play(job.fixtures[0]);
    const first = job.finish().league!.games[0],
      match = resolveSeasonMatch(first, teams);
    expect(first.mastery).toEqual({
      home: Array(8).fill(0),
      away: Array(8).fill(0),
    });
    expect(match.masteryReport?.home.some((p) => p.gained > 0)).toBe(true);
    expect(() => job.play(job.fixtures[0])).toThrow();
    job.fixtures.slice(1).forEach(job.play);
    const league = job.finish().league!;
    expect(teams).toEqual(before);
    expect(Object.values(league.abilityMastery![0]).some((xp) => xp > 0)).toBe(
      true,
    );
    expect(createPlayoffs(league, run.seasonSeed).abilityMastery).toEqual(
      league.abilityMastery,
    );
    const playoffs = simulatePlayoffs(league, run.seasonSeed);
    const facts = captureNewsGames(league.games, playoffs);
    expect(
      validateNewsGames(
        facts,
        job.fixtures,
        teams.map((t) => ROSTER_SLOTS.map((slot) => t.roster[slot]!)),
        run.seasonSeed,
        run.courtVersion,
      ),
    ).toEqual(facts);
    expect(
      replayPlayoffs(league, run.seasonSeed, playoffGameCount(playoffs)),
    ).toEqual(playoffs);
  });
  it("rejects mixed flags, missing or foreign records and invalid XP", () => {
    const teams = createLeague(fixture());
    expect(() => validateLeagueTeams(teams, true)).not.toThrow();
    for (const corrupt of [
      (t: typeof teams) => {
        delete t[1].abilityMasteryVersion;
      },
      (t: typeof teams) => {
        delete t[1].abilityVersion;
      },
      (t: typeof teams) => {
        t[0].abilityMastery![65] = 1000.01;
      },
      (t: typeof teams) => {
        t[0].abilityMastery![65] = 12.345;
      },
      (t: typeof teams) => {
        t[0].abilityMastery![999999] = 4;
      },
    ]) {
      const bad = structuredClone(teams);
      corrupt(bad);
      expect(() => validateLeagueTeams(bad, true)).toThrow();
    }
  });
  it("moves mastery with species in simultaneous packages without mutating sources", () => {
    const teams = createLeague(fixture());
    expect(teams[0].abilityMastery).toBeDefined();
    const give = Object.values(teams[0].roster).slice(0, 3) as number[],
      receive = Object.values(teams[1].roster).slice(0, 3) as number[];
    give.forEach((id) => {
      teams[0].abilityMastery![id] = 302.14;
    });
    receive.forEach((id) => {
      teams[1].abilityMastery![id] = 77.12;
    });
    const before = structuredClone(teams);
    for (const count of [1, 2, 3]) {
      const next = exchangePackage(
        teams,
        0,
        1,
        give.slice(0, count),
        receive.slice(0, count),
      );
      give.slice(0, count).forEach((id) => {
        expect(next[1].abilityMastery![id]).toBe(302.14);
        expect(next[0].abilityMastery![id]).toBeUndefined();
      });
      receive.slice(0, count).forEach((id) => {
        expect(next[0].abilityMastery![id]).toBe(77.12);
      });
      expect(
        next.every((t) => Object.keys(t.abilityMastery!).length === 8),
      ).toBe(true);
    }
    expect(
      exchangePlayers(teams, 0, 1, give[0], receive[0])[1].abilityMastery![
        give[0]
      ],
    ).toBe(302.14);
    expect(teams).toEqual(before);
  });
});

it("validates away official mastery snapshots and credits the saved box only once", async () => {
  const { officialFixture, finishedGame } =
    await import("./officialGame.testUtils");
  const {
    officialGameFromArcade,
    validateOfficialGame,
    validateStoredOfficialGame,
  } = await import("./officialGame");
  const { snapshotMastery, advanceMastery } = await import("./abilityMastery");
  const { nextFranchiseFixture, replaySeasonProgress } =
    await import("./interactiveSeason");
  const { run, teams } = officialFixture(true);
  const fixture = nextFranchiseFixture(run)!;
  teams[0].abilityMastery![teams[0].roster.PG!] = 74.9;
  const frozen = {
    ...fixture,
    mastery: snapshotMastery(
      teams[fixture.homeTeamId],
      teams[fixture.awayTeamId],
    ),
  };
  const state = finishedGame(frozen, teams);
  const game = officialGameFromArcade(state, frozen, teams);
  expect(game.mastery).toEqual(frozen.mastery);
  expect(validateStoredOfficialGame(game, fixture, teams)).toEqual(game);
  for (const corrupt of [
    (g: typeof game) => {
      delete g.abilityMasteryVersion;
    },
    (g: typeof game) => {
      g.mastery!.home[0] += 1;
    },
    (g: typeof game) => {
      g.match.masteryReport!.home[0].after += 1;
    },
  ]) {
    const bad = structuredClone(game);
    corrupt(bad);
    expect(() => validateOfficialGame(bad, frozen, teams)).toThrow();
  }
  const badState = structuredClone(state);
  badState.players[0].masteryXp! += 1;
  expect(() => officialGameFromArcade(badState, frozen, teams)).toThrow();
  const playedGames = { [fixture.id]: game },
    result = replaySeasonProgress(run, 1, playedGames);
  const box =
    fixture.homeTeamId === 0 ? game.match.homeBox : game.match.awayBox;
  expect(result.league!.abilityMastery![0]).toEqual(
    advanceMastery(teams[0], box, game.match.overtimePeriods),
  );
  expect(replaySeasonProgress(run, 1, playedGames)).toEqual(result);
});

it("retains disabled official mastery without effects or XP awards", async () => {
  const { officialFixture, finishedGame } =
    await import("./officialGame.testUtils");
  const { officialGameFromArcade, validateStoredOfficialGame } =
    await import("./officialGame");
  const { snapshotMastery } = await import("./abilityMastery");
  const { fixture, teams } = officialFixture(true);
  for (const t of teams)
    t.engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: true,
      familiarity: 0,
    };
  teams[0].abilityMastery![teams[0].roster.PG!] = 200;
  const frozen = {
    ...fixture,
    mastery: snapshotMastery(
      teams[fixture.homeTeamId],
      teams[fixture.awayTeamId],
    ),
  };
  const game = officialGameFromArcade(
    finishedGame(frozen, teams),
    frozen,
    teams,
  );
  expect(game.abilityVersion).toBeUndefined();
  expect(game.abilityMasteryVersion).toBe(1);
  expect(game.match.masteryReport!.away.every((p) => p.gained === 0)).toBe(
    true,
  );
  expect(validateStoredOfficialGame(game, fixture, teams)).toEqual(game);
});

it("validates two official games in chronological order when mastery is enabled without chemistry", async () => {
  const { officialFixture, finishedGame } =
    await import("./officialGame.testUtils");
  const { officialGameFromArcade } = await import("./officialGame");
  const { nextFranchiseFixture, replaySeasonProgress } =
    await import("./interactiveSeason");
  let { run, teams } = officialFixture();
  delete run.chemistryGrowthVersion;
  delete run.moraleVersion;
  delete run.personalityVersion;
  for (const team of teams) {
    delete team.chemistryGrowthVersion;
    delete team.chemistryBonds;
    delete team.moraleVersion;
    delete team.morale;
    delete team.personalityVersion;
  }
  const first = nextFranchiseFixture(run)!,
    game = officialGameFromArcade(finishedGame(first, teams), first, teams);
  let playedGames = { [first.id]: game };
  const result = replaySeasonProgress(run, 1, playedGames);
  run = {
    ...run,
    seasonProgress: {
      modelVersion: 1,
      completedRounds: 1,
      playedGames,
      result,
    },
  };
  const second = nextFranchiseFixture(run)!,
    next = officialGameFromArcade(finishedGame(second, teams), second, teams);
  playedGames = { ...playedGames, [second.id]: next };
  expect(() => replaySeasonProgress(run, 2, playedGames)).not.toThrow();
});
