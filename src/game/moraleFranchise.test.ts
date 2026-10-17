import { expect, it } from "vitest";
import { initialState, gameReducer } from "./state";
import { createRun } from "./draft";
import { simulateSeason, resolveSeasonMatch } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { prepareGameLoad } from "./persistence";
import { resolveArchivedMatch } from "./archive";
import { retainMorale } from "./playerMorale";
import { replaySeasonProgress } from "./interactiveSeason";
it("carries all 240 morale records from a complete season and postseason into a saved second franchise year", async () => {
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
  expect(Object.values(league.morale!).flatMap(Object.values)).toHaveLength(
    240,
  );
  expect(
    Object.values(league.morale!)
      .flatMap(Object.values)
      .every((p) => p.games === 82),
  ).toBe(true);
  const fixture = league.games[200],
    box = resolveSeasonMatch(fixture, league.teams);
  expect(box.homeScore).toBe(fixture.homeScore);
  const playoffs = simulatePlayoffs(league, initial.run.seasonSeed);
  const season = gameReducer(initial, {
    type: "APPLY_SEASON",
    source: initial.run,
    result,
  });
  const offseason = archiveFranchiseSeason({
    ...season,
    run: { ...season.run, playoffs },
  });
  for (const t of offseason.franchise!.teams)
    expect(t.morale).toEqual(playoffs.morale![t.id]);
  const developed = processOffseason(offseason),
    next = startFranchiseSeason(developed, 823);
  expect(next.franchise!.year).toBe(2);
  for (const t of next.franchise!.teams)
    expect(t.morale).toEqual(
      retainMorale(developed.franchise!.teams[t.id]).morale,
    );
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
  expect(loaded.state.franchise!.teams.map((t) => t.morale)).toEqual(
    next.franchise!.teams.map((t) => t.morale),
  );
  expect(loaded.state.run.seasonProgress!.result!.league!.morale).toEqual(
    progress.league!.morale,
  );
  expect(
    resolveArchivedMatch(loaded.state.franchise!.history[0], fixture),
  ).toEqual(box);
}, 600000);
