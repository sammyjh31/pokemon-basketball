import { describe, expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import { COACHES } from "./trainerCoaches";
import { NEUTRAL_FLOW, type GameFlowFixture } from "./gameFlow";
import * as local from "./localLeague";
import * as career from "./localCareer";
import { simulateLocalSeason } from "./localSeason";
import { simulatePlayoffs, playoffGameCount } from "./playoffs";
import { seasonBuilder } from "./season";
import { startFranchiseSeason } from "./franchise";
import { rookieFixture } from "./rookieDraft.testUtils";
import { validateLeagueTeams } from "./franchiseValidation";
import { ROSTER_SLOTS, type LeagueTeam } from "./types";

const run = () => ({
  ...createRun("free", true, 22),
  coach: { version: 1 as const, id: "misty" },
  roster: { PG: 65, SG: 135, SF: 149, PF: 68, C: 143, B1: 121, B2: 6, B3: 131 },
});
const teams = createLeague(run());
const fouls = (m: ReturnType<typeof simulateMatch>) =>
  [...m.homeBox, ...m.awayBox].reduce((n, b) => n + b.fouls, 0);
const withCoach = (team: LeagueTeam, id: string): LeagueTeam => ({
  ...team,
  coach: { version: 1, id },
});

describe("game flow simulation", () => {
  it("enables game flow for every new club and validates it", () => {
    expect(run().gameFlowVersion).toBe(1);
    expect(teams.every((t) => t.gameFlowVersion === 1)).toBe(true);
    expect(
      validateLeagueTeams(teams, true).every((t) => t.gameFlowVersion === 1),
    ).toBe(true);
  });

  it("is deterministic and reports its context", () => {
    const flow: GameFlowFixture = {
      stage: "regular",
      rest: { home: 0, away: 2 },
      trip: { home: 0, away: 4 },
    };
    const a = simulateMatch(teams[0], teams[1], 77, { flow }),
      b = simulateMatch(teams[0], teams[1], 77, { flow });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.gameFlow).toMatchObject({
      version: 1,
      stage: "regular",
      rest: flow.rest,
      trip: flow.trip,
      arena: { teamId: 0 },
    });
    expect(a.gameFlow!.referee.label).toBeTruthy();
    const neutral = simulateMatch(teams[0], teams[1], 77);
    expect(neutral.gameFlow!.rest).toEqual(NEUTRAL_FLOW.rest);
  });

  it("rejects mixed rules and context without the rules", () => {
    const old = { ...teams[1] };
    delete old.gameFlowVersion;
    expect(() => simulateMatch(teams[0], old, 1)).toThrow(/game flow/);
    const oldHome = { ...teams[0] };
    delete oldHome.gameFlowVersion;
    expect(() =>
      simulateMatch(oldHome, old, 1, { flow: NEUTRAL_FLOW }),
    ).toThrow(/requires game flow/);
    const noCourt = { ...teams[0] };
    delete noCourt.courtVersion;
    expect(() => simulateMatch(noCourt, teams[1], 1)).toThrow();
    expect(() =>
      simulateMatch(teams[0], teams[1], 1, {
        flow: { ...NEUTRAL_FLOW, rest: { home: 9, away: 0 } },
      }),
    ).toThrow(/game flow/);
  });

  it("calls timeouts within each team's budget", () => {
    let total = 0;
    const reasons = new Set<string>();
    for (let seed = 1; seed <= 30; seed++) {
      const m = simulateMatch(teams[seed % 30], teams[(seed + 7) % 30], seed);
      for (const id of [m.homeBox[0].teamId, m.awayBox[0].teamId]) {
        const used = m.gameFlow!.timeouts.filter((t) => t.teamId === id);
        expect(used.length).toBeLessThanOrEqual(6 + 2 * m.overtimePeriods);
        expect(
          used.filter((t) => t.period === 4).length,
        ).toBeLessThanOrEqual(3);
        total += used.length;
      }
      for (const t of m.gameFlow!.timeouts) reasons.add(t.reason);
    }
    expect(total).toBeGreaterThan(30);
    expect(reasons.has("run")).toBe(true);
  }, 240_000);

  it("calls more fouls under tight crews than loose ones", () => {
    const totals = new Map<number, { fouls: number; games: number }>();
    for (let seed = 1; seed <= 72; seed++) {
      const m = simulateMatch(teams[seed % 30], teams[(seed + 11) % 30], seed);
      const key = m.gameFlow!.referee.tightness;
      const row = totals.get(key) ?? { fouls: 0, games: 0 };
      row.fouls += fouls(m);
      row.games++;
      totals.set(key, row);
    }
    const rate = (keys: number[]) => {
      const rows = keys.flatMap((k) => (totals.has(k) ? [totals.get(k)!] : []));
      return (
        rows.reduce((n, r) => n + r.fouls, 0) /
        rows.reduce((n, r) => n + r.games, 0)
      );
    };
    expect(rate([0.5, 1])).toBeGreaterThan(rate([-1, -0.5]));
  }, 240_000);

  it("tightens playoff rotations and manages back-to-backs", () => {
    const restful = COACHES.reduce((best, c) => (c.rest > best.rest ? c : best));
    const home = withCoach(teams[3], restful.id),
      away = withCoach(teams[8], restful.id);
    const playoff: GameFlowFixture = {
      stage: "playoff",
      rest: { home: 1, away: 1 },
      trip: { home: 0, away: 1 },
      playoff: {
        round: 3,
        game: 7,
        homeWins: 3,
        awayWins: 3,
        winsNeeded: 4,
        previous: { winnerId: away.id, margin: 4 },
      },
    };
    let regularBench = 0,
      playoffBench = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const benchMinutes = (m: ReturnType<typeof simulateMatch>) =>
        [m.homeBox, m.awayBox]
          .map((box) => [...box].sort((x, y) => x.minutes - y.minutes)[0].minutes)
          .reduce((a, b) => a + b, 0);
      regularBench += benchMinutes(simulateMatch(home, away, seed));
      const game7 = simulateMatch(home, away, seed, { flow: playoff });
      expect(game7.gameFlow!.elimination).toEqual({ home: true, away: true });
      playoffBench += benchMinutes(game7);
    }
    expect(playoffBench).toBeLessThan(regularBench);
    const backToBack = simulateMatch(home, away, 5, {
      flow: { stage: "regular", rest: { home: 0, away: 2 }, trip: { home: 0, away: 1 } },
    });
    expect(backToBack.gameFlow!.loadManaged).toEqual({ home: true, away: false });
  }, 240_000);
});

describe("game flow lifecycle", () => {
  it("carries context through a local season, playoffs, archive replay and save", () => {
    let draft = local.createLocalLeague(
      [
        { name: "Sam", teamId: 0 },
        { name: "Lee", teamId: 1 },
      ],
      true,
      611,
      2,
      {
        mode: "full-pool",
        format: { teamCount: 4, gamesPerTeam: 14, playoffTeams: 4, bestOf: 3 },
        engineRules: {
          version: 1,
          abilities: true,
          adaptiveCoaching: true,
          familiarity: 0,
        },
      },
    );
    expect(draft.gameFlowVersion).toBe(1);
    delete draft.coachDraftRequired;
    while (local.currentLocalTurn(draft)) {
      draft = local.advanceLocalCpu(draft);
      const turn = local.currentLocalTurn(draft);
      if (!turn) break;
      const mon = local
        .localLeaguePool(draft)
        .find((p) => !draft.picks.some((pick) => pick.pokemonId === p.id))!;
      const slot = ROSTER_SLOTS.find(
        (slot) =>
          !draft.picks.some(
            (pick) => pick.teamId === turn.teamId && pick.slot === slot,
          ),
      )!;
      draft = local.pickLocalPlayer(draft, mon.id, slot);
    }
    const result = simulateLocalSeason(draft);
    const league = result.league!;
    expect(league.teams.every((t) => t.gameFlowVersion === 1)).toBe(true);
    expect(league.games.every((g) => g.flow?.stage === "regular")).toBe(true);
    // Archived summaries replay exactly from their stored context.
    for (const game of league.games.slice(0, 6)) {
      const replay = simulateMatch(
        league.teams[game.homeTeamId],
        league.teams[game.awayTeamId],
        game.seed,
        {
          scouting: game.scouting,
          chemistry: game.chemistry,
          morale: game.morale,
          flow: game.flow,
        },
      );
      expect([replay.homeScore, replay.awayScore]).toEqual([
        game.homeScore,
        game.awayScore,
      ]);
    }
    const playoffs = simulatePlayoffs(league, career.localSeasonSeed(draft));
    const games = playoffs.series.flatMap((s) => s.games);
    expect(games.length).toBeGreaterThan(0);
    for (const game of games) {
      expect(game.flow?.stage).toBe("playoff");
      expect(game.flow?.playoff?.winsNeeded).toBe(2);
    }
    expect(games.some((g) => g.flow!.playoff!.game > 1)).toBe(true);
    draft = career.beginLocalOffseason(
      { ...draft, completed: true, playoffGames: playoffGameCount(playoffs) },
      result,
      playoffs,
    );
    const restored = local.parseLocalLeague(JSON.stringify(draft));
    expect(restored.gameFlowVersion).toBe(1);
    const next = career.startNextLocalSeason(restored);
    expect(next.career!.teams.every((t) => t.gameFlowVersion === 1)).toBe(true);
    expect(local.localLeagueRun(next).gameFlowVersion).toBe(1);
    const tampered = structuredClone(next);
    tampered.career!.teams[1].gameFlowVersion = 2 as never;
    expect(() => local.parseLocalLeague(JSON.stringify(tampered))).toThrow();
  }, 240_000);

  it("adds context to solo season fixtures", () => {
    const season = seasonBuilder(run(), 2);
    season.fixtures.forEach(season.play);
    const result = season.finish();
    const games = result.league!.games;
    expect(games).toHaveLength(30);
    expect(games.every((g) => g.flow?.stage === "regular")).toBe(true);
    expect(games.filter((g) => g.round === 0).every((g) => g.flow!.rest.home === 3)).toBe(true);
  }, 240_000);

  it("adopts game flow at the next solo franchise boundary", () => {
    const state = rookieFixture();
    delete state.run.gameFlowVersion;
    state.franchise!.teams.forEach((team) => delete team.gameFlowVersion);
    const before = JSON.stringify(state);
    const next = startFranchiseSeason(state, 988);
    expect(next.run.gameFlowVersion).toBe(1);
    expect(
      next.franchise!.teams.every((team) => team.gameFlowVersion === 1),
    ).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
});
