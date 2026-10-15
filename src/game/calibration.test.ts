import { describe, it, expect } from "vitest";
import { createRun } from "./draft";
import { simulateSeason } from "./season";
import { ROSTER_SLOTS, type Roster } from "./types";
const season = (ids: number[], seed: number) =>
  simulateSeason({
    ...createRun("free", true, seed),
    roster: Object.fromEntries(
      ROSTER_SLOTS.map((slot, i) => [slot, ids[i]]),
    ) as Roster,
  });
describe("rotation performance", () => {
  it("rewards a strong roster across shared seeds while preserving upset risk", () => {
    let strongWins = 0,
      weakWins = 0,
      points = 0,
      against = 0,
      ots = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const strong = season([65, 135, 149, 68, 143, 121, 6, 131], seed),
        weak = season([10, 13, 11, 14, 129, 19, 16, 41], seed);
      strongWins += strong.wins;
      weakWins += weak.wins;
      points += strong.games.reduce((s, g) => s + g.teamScore, 0);
      against += strong.games.reduce((s, g) => s + g.opponentScore, 0);
      for (const game of strong.games.filter((g) => g.overtime)) {
        ots++;
        expect(game.overtimePeriods).toBeGreaterThan(0);
        expect(game.boxScore!.reduce((sum, p) => sum + p.minutes, 0)).toBe(
          240 + 25 * game.overtimePeriods!,
        );
        expect(game.boxScore!.reduce((sum, p) => sum + p.points, 0)).toBe(
          game.teamScore,
        );
        expect(game.teamScore).not.toBe(game.opponentScore);
      }
    }

    expect(strongWins).toBeGreaterThan(weakWins + 400);
    expect(strongWins).toBeLessThan(1560);
    expect(ots).toBeGreaterThan(0);
    expect(points / 1640).toBeGreaterThan(95);
    expect(points / 1640).toBeLessThan(135);
    expect(against / 1640).toBeGreaterThan(80);
  });
});
