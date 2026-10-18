import { expect, it } from "vitest";
import { initialState, gameReducer } from "./state";
import { createRun } from "./draft";
import { simulateSeason, resolveSeasonMatch } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { prepareGameLoad } from "./persistence";
import { resolveArchivedMatch } from "./archive";
import { replaySeasonProgress } from "./interactiveSeason";
import { buildLeagueNews, franchiseNewsSources } from "./leagueNews";

it("preserves all 240 mastery records through a full season, playoffs, camp, transactions and restored year two", async () => {
  const initial = {
    ...initialState(822),
    run: {
      ...createRun("free", true, 822),
      coach: { version: 1 as const, id: "misty" },
      roster: {
        PG: 65,
        SG: 135,
        SF: 149,
        PF: 68,
        C: 143,
        B1: 121,
        B2: 6,
        B3: 131,
      },
    },
  };
  const result = simulateSeason(initial.run),
    league = result.league!;
  expect(league.games).toHaveLength(1230);
  const regularXp = Object.values(league.abilityMastery!).flatMap(
    Object.values,
  );
  expect(regularXp).toHaveLength(240);
  // Fresh players can earn at most 6 XP in each of the 82 official games.
  expect(regularXp.every((xp) => xp > 0 && xp <= 492)).toBe(true);
  expect(Math.max(...regularXp)).toBeGreaterThan(123);
  const fixture = league.games[200],
    box = resolveSeasonMatch(fixture, league.teams);
  expect(box.homeScore).toBe(fixture.homeScore);
  expect(box.masteryReport?.home).toHaveLength(8);
  expect(box.masteryReport!.home.every((row) => row.after >= row.before)).toBe(
    true,
  );
  expect(
    league.teams.every((t) =>
      Object.values(t.abilityMastery!).every((xp) => xp === 0),
    ),
  ).toBe(true);
  const playoffs = simulatePlayoffs(league, initial.run.seasonSeed);
  for (const team of league.teams)
    for (const id of Object.values(team.roster))
      expect(playoffs.abilityMastery![team.id][id!]).toBeGreaterThanOrEqual(
        league.abilityMastery![team.id][id!],
      );
  const season = gameReducer(initial, {
    type: "APPLY_SEASON",
    source: initial.run,
    result,
  });
  const offseason = archiveFranchiseSeason({
    ...season,
    run: { ...season.run, playoffs },
  });
  for (const team of offseason.franchise!.teams)
    expect(team.abilityMastery).toEqual(playoffs.abilityMastery![team.id]);
  const developed = processOffseason(offseason),
    report = developed.franchise!.offseasons![0];
  expect(report.mastery).toHaveLength(240);
  for (const row of report.mastery!) {
    expect(row.before).toBe(
      playoffs.abilityMastery![row.teamId][row.pokemonId],
    );
    expect(row.gained).toBeGreaterThan(0);
    const owner = developed.franchise!.teams.find((team) =>
      Object.values(team.roster).includes(row.pokemonId),
    )!;
    expect(owner.abilityMastery![row.pokemonId]).toBe(row.after);
  }
  expect(processOffseason(developed)).toBe(developed);
  const next = startFranchiseSeason(developed, 823);
  expect(next.franchise!.year).toBe(2);
  for (const team of next.franchise!.teams) {
    expect(team.abilityMasteryVersion).toBe(1);
    expect(team.abilityMastery).toEqual(
      developed.franchise!.teams[team.id].abilityMastery,
    );
  }
  const progress = replaySeasonProgress(next.run, 1, {});
  const saving = {
    ...next,
    run: {
      ...next.run,
      seasonProgress: {
        modelVersion: 1 as const,
        completedRounds: 1,
        playedGames: {},
        result: progress,
      },
    },
  };
  const prepared = prepareGameLoad(
    { getItem: () => JSON.stringify(saving), setItem: () => {} },
    823,
  );
  expect(prepared.notice).toBeNull();
  const loaded = prepared.restore
    ? await prepared.restore(() => {}, new AbortController().signal)
    : prepared;
  expect(loaded.notice).toBeNull();
  expect(
    loaded.state.franchise!.teams.map((team) => team.abilityMastery),
  ).toEqual(next.franchise!.teams.map((team) => team.abilityMastery));
  expect(
    loaded.state.run.seasonProgress!.result!.league!.abilityMastery,
  ).toEqual(progress.league!.abilityMastery);
  expect(
    resolveArchivedMatch(loaded.state.franchise!.history[0], fixture),
  ).toEqual(box);
  const news = buildLeagueNews(
    franchiseNewsSources(loaded.state.franchise!, loaded.state.run),
  );
  expect(news.some((story) => story.id === "1:champion")).toBe(true);
  expect(
    news.filter((story) => story.id.startsWith("1:mastery:training:")),
  ).toHaveLength(240);
  expect(new Set(news.map((story) => story.id)).size).toBe(news.length);
}, 600000);
