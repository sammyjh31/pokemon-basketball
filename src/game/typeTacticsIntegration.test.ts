import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
import {
  emptyScouting,
  recordScouting,
  scoutingForMatch,
} from "./opponentScouting";
import { localSeasonBuilder } from "./localSeason";
import {
  simulatePlayoffs,
  simulatePlayoffsAsync,
  replayPlayoffs,
  resolvePlayoffMatch,
} from "./playoffs";
import { resolveSeasonMatch, seasonBuilder } from "./season";
import { leagueSchedule } from "./league";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade } from "./officialGame";
import type { LeagueTeam } from "./types";
import type { ScoutingMemory } from "./typeTacticsTypes";
const roster = {
  PG: 65,
  SG: 135,
  SF: 149,
  PF: 68,
  C: 143,
  B1: 121,
  B2: 6,
  B3: 131,
};
const teams = (): LeagueTeam[] =>
  createLeague({ ...createRun("free", false, 42), roster })
    .slice(0, 4)
    .map((t) => ({ ...t, typeTacticsVersion: 1 as const }));
const format = {
  teamCount: 4,
  gamesPerTeam: 14,
  playoffTeams: 4,
  bestOf: 3,
} as const;

it("produces deterministic tactical events with legal boxes and immutable inputs", () => {
  const [home, away] = teams(),
    before = structuredClone([home, away]);
  const match = simulateMatch(home, away, 123);
  expect(match).toEqual(simulateMatch(home, away, 123));
  expect([home, away]).toEqual(before);
  for (const side of ["home", "away"] as const) {
    const r = match.typeTactics![side];
    expect(r.priorMeetings).toBe(0);
    expect(r.screens).toBeGreaterThan(0);
    expect(r.crossMatches).toBeGreaterThan(0);
    expect(r.rolls).toBeLessThanOrEqual(r.screens);
    expect(
      match[(side + "Box") as "homeBox" | "awayBox"].reduce(
        (n, p) => n + p.points,
        0,
      ),
    ).toBe(match[(side + "Score") as "homeScore" | "awayScore"]);
  }
  const samples = teams()
    .slice(1)
    .map((t) => simulateMatch(home, t, 123));
  expect(
    samples.reduce(
      (n, m) =>
        n +
        m.typeTactics!.home.helpRotations +
        m.typeTactics!.away.helpRotations,
      0,
    ),
  ).toBeGreaterThan(0);
  expect(
    samples.reduce(
      (n, m) => n + m.typeTactics!.home.kickouts + m.typeTactics!.away.kickouts,
      0,
    ),
  ).toBeGreaterThan(0);
  expect(match.typeTactics!.home.switches + match.typeTactics!.home.stays).toBe(
    match.typeTactics!.away.screens,
  );
});

it("learns from the previous encounter, without mutating its context or unrelated opponents", () => {
  const [home, away, other] = teams(),
    memory: ScoutingMemory = {};
  const first = simulateMatch(home, away, 123);
  recordScouting(memory, home, away, first);
  const context = scoutingForMatch(memory, home.id, away.id),
    before = structuredClone(context);
  const learned = simulateMatch(home, away, 123, { scouting: context });
  expect(learned.typeTactics!.home.priorMeetings).toBe(1);
  expect(learned.typeTactics!.home.priorityThreatId).toBeDefined();
  expect(learned.homeBox).not.toEqual(first.homeBox);
  expect(context).toEqual(before);
  expect(scoutingForMatch(memory, home.id, other.id).home).toEqual(
    emptyScouting(),
  );
});

it("stores pregame scouting and reproduces individual regular-season games", () => {
  const job = localSeasonBuilder(teams(), format, 42);
  job.fixtures.forEach(job.play);
  const league = job.finish().league!;
  expect(league.scouting).toBeDefined();
  for (const game of league.games) {
    const match = resolveSeasonMatch(game, league.teams);
    expect([match.homeScore, match.awayScore]).toEqual([
      game.homeScore,
      game.awayScore,
    ]);
    const prior = league.games.filter(
      (g) =>
        g.round < game.round &&
        [g.homeTeamId, g.awayTeamId].includes(game.homeTeamId) &&
        [g.homeTeamId, g.awayTeamId].includes(game.awayTeamId),
    ).length;
    expect(game.scouting!.home.games).toBe(prior);
    expect(game.scouting!.away.games).toBe(prior);
  }
});

it("carries scouting into playoffs and agrees across batch, step, async and replay", async () => {
  const job = localSeasonBuilder(teams(), format, 42);
  job.fixtures.forEach(job.play);
  const league = job.finish().league!,
    before = structuredClone(league);
  const all = simulatePlayoffs(league, 42, undefined, "all");
  expect(all.scouting).toBeUndefined();
  let stepped = simulatePlayoffs(league, 42, undefined, "game");
  while (stepped.championId === null)
    stepped = simulatePlayoffs(league, 42, stepped, "game");
  expect(stepped).toEqual(all);
  expect(await simulatePlayoffsAsync(league, 42, undefined, "all")).toEqual(
    all,
  );
  expect(
    replayPlayoffs(
      league,
      42,
      all.series.reduce((n, s) => n + s.games.length, 0),
    ),
  ).toEqual(all);
  for (const series of all.series)
    for (const [index, game] of series.games.entries()) {
      const prior =
        before.scouting![`${game.homeTeamId}:${game.awayTeamId}`].games;
      expect(game.scouting!.home.games).toBe(prior + index);
      expect(game.scouting!.away.games).toBe(prior + index);
      const match = resolvePlayoffMatch(game, league.teams);
      expect([match.homeScore, match.awayScore]).toEqual([
        game.homeScore,
        game.awayScore,
      ]);
    }
  expect(league).toEqual(before);
});

it("keeps old rules opt-in and rejects incompatible context", () => {
  const [home, away] = teams();
  delete home.typeTacticsVersion;
  delete away.typeTacticsVersion;
  expect(simulateMatch(home, away, 12).typeTactics).toBeUndefined();
  expect(() =>
    simulateMatch(home, away, 12, { scouting: scoutingForMatch({}, 0, 1) }),
  ).toThrow(/scouting/i);
  expect(() =>
    simulateMatch({ ...home, typeTacticsVersion: 1 }, away, 12),
  ).toThrow(/type tactics/i);
});

it("learns authoritative played boxes while retaining their exact result", () => {
  const { run, teams } = officialFixture();
  const fixture = leagueSchedule(run.seasonSeed).find(
    (f) => f.round === 0 && (f.homeTeamId === 0 || f.awayTeamId === 0),
  )!;
  const official = officialGameFromArcade(
    finishedGame(fixture, teams),
    fixture,
    teams,
  );
  const job = seasonBuilder(run, 1, { [fixture.id]: official });
  job.fixtures.forEach(job.play);
  const league = job.finish().league!;
  const summary = league.games.find((g) => g.id === fixture.id)!;
  expect(
    resolveSeasonMatch(summary, teams, { [fixture.id]: official }),
  ).toEqual(official.match);
  expect(summary.scouting!.home.games).toBe(0);
  const learned = scoutingForMatch(
    league.scouting!,
    fixture.homeTeamId,
    fixture.awayTeamId,
  );
  expect(learned.home.games).toBe(1);
  for (const row of official.match.awayBox) {
    expect(learned.home.players[row.pokemonId].attempts).toBe(row.fga);
    expect(learned.home.players[row.pokemonId].points).toBe(
      2 * row.fgm + row.threePM,
    );
  }
  expect(learned.home.switches).toBe(0);
});
