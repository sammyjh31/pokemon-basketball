import { expect, it } from "vitest";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";

it("persists chemistry in official games and rejects absent, invalid and mixed participant versions", () => {
  const { teams, fixture } = officialFixture();
  teams.forEach((team) => Object.assign(team, { chemistryVersion: 1 }));
  const state = finishedGame(fixture, teams);
  Object.assign(state, { chemistryVersion: 1 });
  const game = officialGameFromArcade(state, fixture, teams);
  expect(game.chemistryVersion).toBe(1);
  expect(
    validateOfficialGame(JSON.parse(JSON.stringify(game)), fixture, teams),
  ).toEqual(game);
  for (const version of [undefined, 2]) {
    expect(() =>
      validateOfficialGame(
        { ...game, chemistryVersion: version },
        fixture,
        teams,
      ),
    ).toThrow();
    expect(() =>
      officialGameFromArcade(
        { ...state, chemistryVersion: version } as typeof state,
        fixture,
        teams,
      ),
    ).toThrow();
  }
  const opponent = teams.find(
    (team) =>
      team.id !== 0 &&
      [fixture.homeTeamId, fixture.awayTeamId].includes(team.id),
  )!;
  delete opponent.chemistryVersion;
  expect(() => validateOfficialGame(game, fixture, teams)).toThrow();
  expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
});

it("keeps chemistry independent of disabled ability effects and ignores non-participant flags", () => {
  const { teams, fixture } = officialFixture(true);
  teams.forEach((team) => {
    Object.assign(team, { chemistryVersion: 1 });
    team.engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: false,
      familiarity: 0,
    };
  });
  const other = teams.find(
    (team) => ![fixture.homeTeamId, fixture.awayTeamId].includes(team.id),
  )!;
  delete other.chemistryVersion;
  const game = officialGameFromArcade(
    finishedGame(fixture, teams),
    fixture,
    teams,
  );
  expect(game.chemistryVersion).toBe(1);
  expect(game).not.toHaveProperty("abilityVersion");
  expect(validateOfficialGame(game, fixture, teams)).toEqual(game);
});

it("preserves missing chemistry on historical official games", () => {
  const { teams, fixture } = officialFixture();
  teams.forEach((team) => {
    delete team.chemistryVersion;
    delete team.chemistryGrowthVersion;
    delete team.moraleVersion;
    delete team.personalityVersion;
    delete team.chemistryBonds;
    delete team.morale;
  });
  const game = officialGameFromArcade(
    finishedGame(fixture, teams),
    fixture,
    teams,
  );
  expect(game).not.toHaveProperty("chemistryVersion");
  expect(validateOfficialGame(game, fixture, teams)).toEqual(game);
  expect(() =>
    validateOfficialGame({ ...game, chemistryVersion: 1 }, fixture, teams),
  ).toThrow();
});
