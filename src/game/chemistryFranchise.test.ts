import { expect, it } from "vitest";
import { createRun } from "./draft";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { prepareGameLoad } from "./persistence";
import { resolveArchivedMatch } from "./archive";
import { simulateMatch } from "./match";

it("restores chemistry season, playoff and career totals, lineup reports and frozen archives", async () => {
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
  const result = simulateSeason(initial.run);
  const season = gameReducer(initial, {
    type: "APPLY_SEASON",
    source: initial.run,
    result,
  });
  const firstFixture = result.league!.games[0];
  const firstMatch = simulateMatch(
    result.league!.teams[firstFixture.homeTeamId],
    result.league!.teams[firstFixture.awayTeamId],
    firstFixture.seed,
    { scouting: firstFixture.scouting },
  );
  expect(firstMatch.insights!.lineups.length).toBeGreaterThan(0);
  expect(
    firstMatch.insights!.lineups.every(
      (lineup) =>
        lineup.playerIds.length === 5 &&
        new Set(lineup.playerIds).size === 5 &&
        lineup.chemistry !== undefined &&
        lineup.chemistry.score >= 0 &&
        lineup.chemistry.score <= 100 &&
        Object.keys(lineup.chemistry.effects).every((id) =>
          lineup.playerIds.includes(`${lineup.teamId}:${id}`),
        ) &&
        lineup.chemistry.links.every((link) =>
          link.pokemonIds.every((id) =>
            lineup.playerIds.includes(`${lineup.teamId}:${id}`),
          ),
        ),
    ),
  ).toBe(true);
  const playoffs = simulatePlayoffs(result.league!, initial.run.seasonSeed);
  const archived = processOffseason(
    archiveFranchiseSeason({ ...season, run: { ...season.run, playoffs } }),
  );
  expect(archived.franchise!.teams.every((t) => t.chemistryVersion === 1)).toBe(
    true,
  );
  const frozen = archived.franchise!.history[0];
  expect(
    frozen.replay!.teams.every((team) => team.chemistryVersion === 1),
  ).toBe(true);
  expect(resolveArchivedMatch(frozen, firstFixture)).toEqual(firstMatch);
  const regular = archived.franchise!.history[0].replay!.regularPlayers;
  const playoff = archived.franchise!.history[0].replay!.playoffPlayers;
  expect(
    regular.some(
      (player) => (player.abilityActivations?.physical?.movement ?? 0) > 0,
    ),
  ).toBe(true);
  expect(
    playoff.some(
      (player) => (player.abilityActivations?.physical?.energySaved ?? 0) > 0,
    ),
  ).toBe(true);
  for (const player of regular) {
    expect(
      archived.franchise!.careers.find(
        (career) => career.pokemonId === player.pokemonId,
      )!.regular.abilityActivations,
    ).toEqual(player.abilityActivations);
  }
  const prepared = prepareGameLoad(
    { getItem: () => JSON.stringify(archived), setItem: () => {} },
    822,
  );
  expect(prepared.notice).toBeNull();
  const loaded = prepared.restore
    ? await prepared.restore(() => {}, new AbortController().signal)
    : prepared;
  expect(loaded.notice).toBeNull();
  expect(loaded.state.franchise!.history).toEqual(archived.franchise!.history);
  expect(loaded.state.franchise!.offseasons).toEqual(
    archived.franchise!.offseasons,
  );
  expect(loaded.state.franchise!.trades).toEqual(archived.franchise!.trades);
  expect(
    resolveArchivedMatch(loaded.state.franchise!.history[0], firstFixture),
  ).toEqual(firstMatch);
  const next = startFranchiseSeason(loaded.state, 823);
  expect(next.franchise!.year).toBe(2);
  expect(next.franchise!.history).toEqual(archived.franchise!.history);
  expect(next.run.chemistryVersion).toBe(1);
  expect(
    next.franchise!.teams.every((t) => Object.values(t.roster).length === 8),
  ).toBe(true);
  expect(
    new Set(next.franchise!.teams.flatMap((t) => Object.values(t.roster))).size,
  ).toBe(240);
  const after = prepareGameLoad(
    { getItem: () => JSON.stringify(next), setItem: () => {} },
    823,
  );
  expect(after.notice).toBeNull();
  const mismatched = structuredClone(next);
  delete mismatched.run.chemistryVersion;
  expect(
    prepareGameLoad(
      { getItem: () => JSON.stringify(mismatched), setItem: () => {} },
      823,
    ).notice,
  ).toBeTruthy();
  const mixedArchive = structuredClone(next);
  delete mixedArchive.franchise!.history[0].replay!.teams[1].chemistryVersion;
  expect(
    prepareGameLoad(
      { getItem: () => JSON.stringify(mixedArchive), setItem: () => {} },
      822,
    ).notice,
  ).toBeTruthy();
}, 240000);
