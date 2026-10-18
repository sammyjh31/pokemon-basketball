import { beforeAll, expect, it } from "vitest";
import { hasMatchingSeasonInputs } from "./archive";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import type { SeasonReplayArchive } from "./franchiseFeatures";
import type { Run } from "./types";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade } from "./officialGame";

type Inputs = Pick<
  SeasonReplayArchive,
  "teams" | "seasonModel" | "playedGames"
>;
let run: Run, inputs: Inputs;
beforeAll(() => {
  run = performanceRun();
  inputs = { teams: createLeague(run), seasonModel: 3, playedGames: {} };
});

it("matches complete simulation inputs without trusting cached team ratings", () => {
  const recorded = structuredClone(inputs);
  recorded.teams[0].ratings.offense = -999;
  expect(hasMatchingSeasonInputs(run, run.seasonSeed, recorded)).toBe(true);
});

it.each([
  [
    "seed",
    (r: Run) => {
      r.seasonSeed++;
    },
  ],
  [
    "starting roles",
    (r: Run) => {
      [r.roster.PG, r.roster.SG] = [r.roster.SG, r.roster.PG];
    },
  ],
  [
    "game plan",
    (r: Run) => {
      r.tactic = "interior";
    },
  ],
  [
    "trainer",
    (r: Run) => {
      r.coach = { version: 1, id: "ash" };
    },
  ],
  [
    "court rules",
    (r: Run) => {
      r.courtVersion = 3;
    },
  ],
] as const)("does not reuse a season after its %s changes", (_name, change) => {
  const changed = structuredClone(run);
  change(changed);
  expect(hasMatchingSeasonInputs(changed, run.seasonSeed, inputs)).toBe(false);
});

it("keeps different result model versions separate even with identical clubs", () => {
  const fixed = { ...run, leagueTeams: inputs.teams };
  expect(hasMatchingSeasonInputs(fixed, run.seasonSeed, inputs)).toBe(false);
});

it("requires identical official games and a completed season prefix", () => {
  const setup = officialFixture();
  const game = officialGameFromArcade(
    finishedGame(setup.fixture, setup.teams),
    setup.fixture,
    setup.teams,
  );
  const playedGames = { [setup.fixture.id]: game };
  const complete: Run = {
    ...setup.run,
    seasonProgress: { modelVersion: 1, completedRounds: 82, playedGames },
  };
  const recorded: Inputs = { teams: setup.teams, seasonModel: 6, playedGames };
  expect(hasMatchingSeasonInputs(complete, complete.seasonSeed, recorded)).toBe(
    true,
  );
  expect(
    hasMatchingSeasonInputs(complete, complete.seasonSeed, {
      ...recorded,
      playedGames: {},
    }),
  ).toBe(false);
  const partial = structuredClone(complete);
  partial.seasonProgress!.completedRounds = 81;
  expect(hasMatchingSeasonInputs(partial, complete.seasonSeed, recorded)).toBe(
    false,
  );
});

it("includes pregame mastery, morale, shared history and developed skills in the identity", () => {
  const setup = officialFixture();
  const complete: Run = {
    ...setup.run,
    seasonProgress: { modelVersion: 1, completedRounds: 82, playedGames: {} },
  };
  const recorded: Inputs = {
    teams: setup.teams,
    seasonModel: 6,
    playedGames: {},
  };
  expect(hasMatchingSeasonInputs(complete, complete.seasonSeed, recorded)).toBe(
    true,
  );
  for (const field of ["mastery", "morale", "bonds", "development"] as const) {
    const changed = structuredClone(complete);
    const team = changed.leagueTeams![0];
    const id = team.roster.PG!;
    if (field === "mastery") team.abilityMastery![id] = 75;
    if (field === "morale") team.morale![id].score = 65;
    if (field === "bonds")
      team.chemistryBonds = {
        [`${Math.min(id, team.roster.SG!)}:${Math.max(id, team.roster.SG!)}`]: 600,
      };
    if (field === "development")
      changed.leagueTeams = changed.leagueTeams!.map((t) => ({
        ...t,
        development: Object.fromEntries(
          Object.values(t.roster).map((mon) => [
            mon!,
            mon === id ? { speed: 5 } : {},
          ]),
        ),
      }));
    expect(
      hasMatchingSeasonInputs(changed, complete.seasonSeed, recorded),
      field,
    ).toBe(false);
  }
});
