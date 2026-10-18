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
it("restores new-season mastery milestones without accepting inflated legacy gains", () => {
  const milestone = {
    teamId: 0,
    pokemonId: 65,
    before: 74,
    after: 80,
    gained: 6,
    levelBefore: "Developing",
    levelAfter: "Practiced",
  };
  const facts = [{ ...game, masteryMilestones: [milestone] }];
  expect(archive.validateNewsGames(facts, [fixture], rosters, 43, 4)).toEqual(
    facts,
  );
  expect(() =>
    archive.validateNewsGames(facts, [fixture], rosters, 43, 3),
  ).toThrow();
  expect(() =>
    archive.validateNewsGames(facts, [fixture], rosters, 43),
  ).toThrow();
  expect(() =>
    archive.validateNewsGames(
      [
        {
          ...game,
          masteryMilestones: [
            {
              ...milestone,
              after: 80.01,
              gained: 6.01,
            },
          ],
        },
      ],
      [fixture],
      rosters,
      43,
      4,
    ),
  ).toThrow();
});
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
