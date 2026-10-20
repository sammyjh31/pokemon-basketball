import { expect, it } from "vitest";
import { officialFixture, finishedGame } from "./officialGame.testUtils";
import { officialGameFromArcade, validateOfficialGame } from "./officialGame";
it("keeps played games from injecting simulated counter scouting", () => {
  const { teams, fixture } = officialFixture();
  const game = officialGameFromArcade(
    finishedGame(fixture, teams),
    fixture,
    teams,
  );
  expect(validateOfficialGame(game, fixture, teams)).toEqual(game);
  for (const extra of [
    {
      moveObservations: { home: { moves: { "quick-attack": 50 }, combos: {} } },
    },
    { counterPlans: { home: [], away: [] } },
  ]) {
    const forged = { ...game, match: { ...game.match, ...extra } };
    expect(() => validateOfficialGame(forged, fixture, teams)).toThrow();
  }
});
