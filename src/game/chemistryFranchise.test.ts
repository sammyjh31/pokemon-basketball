import { validateFranchise } from "./franchiseValidation";
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
  expect(
    result.league!.teams.every(
      (team) => Object.keys(team.chemistryBonds ?? {}).length === 0,
    ),
  ).toBe(true);
  expect(result.league!.chemistryBonds).toBeDefined();
  expect(
    Object.values(result.league!.chemistryBonds![0]).some(
      (minutes) => minutes > 0,
    ),
  ).toBe(true);
  const firstFixture = result.league!.games[200];
  const firstMatch = simulateMatch(
    result.league!.teams[firstFixture.homeTeamId],
    result.league!.teams[firstFixture.awayTeamId],
    firstFixture.seed,
    { scouting: firstFixture.scouting, chemistry: firstFixture.chemistry },
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
  for (const [id, bank] of Object.entries(result.league!.chemistryBonds!))
    for (const [key, minutes] of Object.entries(bank))
      expect(playoffs.chemistryBonds![Number(id)][key]).toBeGreaterThanOrEqual(
        minutes,
      );
  const frozenOffseason = archiveFranchiseSeason({
    ...season,
    run: { ...season.run, playoffs },
  });
  for (const team of frozenOffseason.franchise!.teams)
    expect(team.chemistryBonds).toEqual(playoffs.chemistryBonds![team.id]);
  const archived = processOffseason(frozenOffseason);
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
  const tamperedOffseason = structuredClone(loaded.state);
  const offKey = Object.keys(
    tamperedOffseason.franchise!.teams[0].chemistryBonds!,
  )[0];
  tamperedOffseason.franchise!.teams[0].chemistryBonds![offKey] += 1;
  expect(() =>
    validateFranchise(tamperedOffseason.franchise, tamperedOffseason.run, true),
  ).toThrow();
  const tamperedArchive = structuredClone(loaded.state);
  tamperedArchive.franchise!.history[0].replay!.teams[0].chemistryBonds![
    offKey
  ] = 1;
  expect(() =>
    validateFranchise(tamperedArchive.franchise, tamperedArchive.run, true),
  ).toThrow();
  const next = startFranchiseSeason(loaded.state, 823);
  expect(next.franchise!.year).toBe(2);
  expect(next.franchise!.history).toEqual(archived.franchise!.history);
  expect(next.run.chemistryVersion).toBe(1);
  expect(next.run.chemistryGrowthVersion).toBe(1);
  for (const [key, minutes] of Object.entries(
    loaded.state.franchise!.teams[0].chemistryBonds!,
  ))
    expect(next.franchise!.teams[0].chemistryBonds![key]).toBe(
      Math.round((Math.round(minutes * 100) * 9) / 10) / 100,
    );
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
  for (const target of ["franchise", "run", "both"] as const) {
    const tampered = structuredClone(next);
    const key = Object.keys(tampered.franchise!.teams[0].chemistryBonds!)[0];
    if (target !== "run")
      tampered.franchise!.teams[0].chemistryBonds![key] += 1;
    if (target !== "franchise")
      tampered.run.leagueTeams![0].chemistryBonds![key] += 1;
    expect(() =>
      validateFranchise(tampered.franchise, tampered.run, true),
    ).toThrow();
  }
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
}, 600000);
