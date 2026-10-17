import { expect, it } from "vitest";
import * as archive from "./archive";
const fixture = {
  id: "test-game",
  round: 0,
  homeTeamId: 0,
  awayTeamId: 1,
  seed: 43,
};
const rosters = [
  [65, 135, 149, 68, 143, 121, 6, 131],
  [1, 2, 3, 4, 5, 7, 8, 9],
];
const game = { ...fixture, homeScore: 99, awayScore: 92, overtimePeriods: 0 };
it("rejects malformed legacy news facts and mastery claims before rendering", () => {
  expect(archive.validateNewsGames).toBeTypeOf("function");
  expect(archive.validateNewsGames([game], [fixture], rosters, 43)).toEqual([
    game,
  ]);
  for (const malformed of [
    [null],
    [{}],
    [{ ...game, homeScore: "99" }],
    [{ ...game, id: "unknown" }],
    [{ ...game, seed: 44 }],
    [
      {
        ...game,
        masteryMilestones: [
          {
            teamId: 0,
            pokemonId: 999,
            before: 74.8,
            after: 75.2,
            gained: 0.4,
            levelBefore: "Developing",
            levelAfter: "Practiced",
          },
        ],
      },
    ],
  ])
    expect(() =>
      archive.validateNewsGames(malformed, [fixture], rosters, 43),
    ).toThrow();
});
