import { expect, it } from "vitest";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";

const physical = { movement: 12.25, screens: 2, rebounds: 3, energySaved: 4.5 };

it("retains actual physical ability stats in official results without the score multiplier", () => {
  const { teams, fixture } = officialFixture();
  teams.forEach((team) => {
    team.physicalAbilityVersion = 1;
  });
  const state = finishedGame(fixture, teams);
  Object.assign(state, { physicalAbilityVersion: 1 });
  Object.assign(state.players[0].stats.abilityActivations!, { physical });
  const game = officialGameFromArcade(state, fixture, teams);
  expect(game.physicalAbilityVersion).toBe(1);
  expect(game.match.homeBox[0].abilityActivations).toMatchObject({ physical });
  expect(
    validateOfficialGame(JSON.parse(JSON.stringify(game)), fixture, teams),
  ).toEqual(game);
  for (const change of [
    (bad: typeof game) => {
      delete bad.physicalAbilityVersion;
    },
    (bad: typeof game) => {
      Object.assign(bad, { physicalAbilityVersion: 2 });
    },
    (bad: typeof game) => {
      Object.assign(bad.match.homeBox[7].abilityActivations!, { physical });
    },
    (bad: typeof game) => {
      Object.assign(bad.match.homeBox[0].abilityActivations!, {
        physical: { ...physical, screens: 0.5 },
      });
    },
  ]) {
    const bad = structuredClone(game);
    change(bad);
    expect(() => validateOfficialGame(bad, fixture, teams)).toThrow();
  }
});

it("does not let historical official results acquire physical stats or version flags", () => {
  const { teams, fixture } = officialFixture();
  teams.forEach((team) => {
    delete team.physicalAbilityVersion;
  });
  const state = finishedGame(fixture, teams);
  const game = officialGameFromArcade(state, fixture, teams);
  expect(game).not.toHaveProperty("physicalAbilityVersion");
  expect(validateOfficialGame(game, fixture, teams)).toEqual(game);
  const injected = structuredClone(game);
  Object.assign(injected.match.homeBox[0].abilityActivations!, { physical });
  expect(() => validateOfficialGame(injected, fixture, teams)).toThrow();
  Object.assign(state.players[0].stats.abilityActivations!, { physical });
  expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
  injected.physicalAbilityVersion = 1;
  expect(() => validateOfficialGame(injected, fixture, teams)).toThrow();
});

it("requires matching active physical rules for official state, result and participating teams", () => {
  const { teams, fixture } = officialFixture();
  teams.forEach((team) => {
    team.physicalAbilityVersion = 1;
  });
  const state = finishedGame(fixture, teams);
  delete (state as { physicalAbilityVersion?: 1 }).physicalAbilityVersion;
  expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
  Object.assign(state, { physicalAbilityVersion: 1 });
  const game = officialGameFromArcade(state, fixture, teams);
  delete teams[fixture.awayTeamId].physicalAbilityVersion;
  expect(() => officialGameFromArcade(state, fixture, teams)).toThrow();
  expect(() => validateOfficialGame(game, fixture, teams)).toThrow();
  teams[fixture.awayTeamId].physicalAbilityVersion = 1;
  teams.forEach((team) => {
    team.engineRules = {
      version: 1,
      abilities: false,
      adaptiveCoaching: false,
      familiarity: 0,
    };
  });
  expect(() => validateOfficialGame(game, fixture, teams)).toThrow();
  const disabled = officialGameFromArcade(
    finishedGame(fixture, teams),
    fixture,
    teams,
  );
  expect(disabled).not.toHaveProperty("physicalAbilityVersion");
  expect(disabled.match.homeBox.every((box) => !box.abilityActivations)).toBe(
    true,
  );
});
