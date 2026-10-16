import { expect, it } from "vitest";
import { simulateMatch } from "./match";
import { teamRatings } from "./ratings";
import { ROSTER_SLOTS, type LeagueTeam, type Roster } from "./types";
const team = (id: number, ids: number[]): LeagueTeam => {
  const roster = Object.fromEntries(
    ROSTER_SLOTS.map((slot, i) => [slot, ids[i]]),
  ) as Roster;
  return {
    id,
    name: `Test club ${id}`,
    roster,
    tactic: "balanced",
    rotation: "balanced",
    defense: "man",
    ratings: teamRatings(roster),
  };
};
it("rewards stronger player skills across shared match seeds while allowing upsets", () => {
  const ids = [65, 135, 149, 68, 143, 121, 6, 131];
  const strong = team(0, ids),
    weak = team(0, [10, 13, 11, 14, 129, 19, 16, 41]),
    opponent = team(1, ids);
  let strongWins = 0,
    weakWins = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const home = seed % 2 === 0;
    const first = simulateMatch(
      home ? strong : opponent,
      home ? opponent : strong,
      seed,
    );
    const second = simulateMatch(
      home ? weak : opponent,
      home ? opponent : weak,
      seed,
    );
    strongWins += Number(
      home
        ? first.homeScore > first.awayScore
        : first.awayScore > first.homeScore,
    );
    weakWins += Number(
      home
        ? second.homeScore > second.awayScore
        : second.awayScore > second.homeScore,
    );
  }
  expect(strongWins).toBeGreaterThan(weakWins + 35);
  expect(strongWins).toBeLessThan(110);
});
