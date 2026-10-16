import { describe, it, expect } from "vitest";
import { createRun, placePokemon } from "./draft";
import { simulateSeason } from "./v2Season";
import { ROSTER_SLOTS } from "./types";
const full = (seed = 31) => {
  let run = createRun("free", true, seed);
  [65, 135, 6, 68, 143, 9, 94, 59].forEach((id, i) => {
    run = placePokemon(run, id, ROSTER_SLOTS[i]);
  });
  return run;
};
describe("frozen v2 possession box scores and team awards", () => {
  it("conserves points, minutes and shot arithmetic across every game", () => {
    const result = simulateSeason(full());
    expect(result.modelVersion).toBe(2);
    expect(result.playerStats).toHaveLength(8);
    expect(result.awards).toHaveLength(6);
    for (const game of result.games) {
      expect(game.boxScore).toHaveLength(8);
      expect(game.boxScore!.reduce((s, p) => s + p.points, 0)).toBe(
        game.teamScore,
      );
      expect(game.boxScore!.reduce((s, p) => s + p.minutes, 0)).toBe(
        240 + 25 * game.overtimePeriods!,
      );
      expect(game.won).toBe(game.teamScore > game.opponentScore);
      for (const p of game.boxScore!) {
        expect(p.points).toBe(2 * p.fgm + p.threePM + p.ftm);
        expect(p.fgm).toBeLessThanOrEqual(p.fga);
        expect(p.threePM).toBeLessThanOrEqual(p.threePA);
        expect(p.threePA).toBeLessThanOrEqual(p.fga);
        expect(p.threePM).toBeLessThanOrEqual(p.fgm);
        expect(p.fgm - p.threePM).toBeLessThanOrEqual(p.fga - p.threePA);
        expect(p.ftm).toBeLessThanOrEqual(p.fta);
        expect(p.minutes).toBeLessThanOrEqual(48 + 5 * game.overtimePeriods!);
        for (const [k, v] of Object.entries(p))
          if (k !== "slot")
            expect(Number.isInteger(v) && Number(v) >= 0).toBe(true);
      }
      expect(
        game.boxScore!.reduce((s, p) => s + p.assists, 0),
      ).toBeLessThanOrEqual(game.boxScore!.reduce((s, p) => s + p.fgm, 0));
    }
    expect(result.playerStats!.reduce((s, p) => s + p.points, 0)).toBe(
      result.games.reduce((s, g) => s + g.teamScore, 0),
    );
    for (const p of result.playerStats!) {
      expect(p.gamesPlayed).toBe(82);
      expect(p.gamesStarted).toBe(p.slot.startsWith("B") ? 0 : 82);
    }
    expect(result.awards!.find((a) => a.id === "sixth")!.pokemonId).toSatisfy(
      (id: number) => [9, 94, 59].includes(id),
    );
    expect(result.awards!.find((a) => a.id === "mvp")!.pokemonId).toBe(
      result.mvpId,
    );
  });
  it("replays the entire statistical season and changes outcomes with coaching", () => {
    const run = full();
    expect(simulateSeason(run)).toEqual(simulateSeason(run));
    const balanced = simulateSeason(run),
      perimeter = simulateSeason({ ...run, tactic: "perimeter" });
    expect(balanced.playerStats).not.toEqual(perimeter.playerStats);
    expect(
      perimeter.playerStats!.reduce((s, p) => s + p.threePA, 0),
    ).toBeGreaterThan(balanced.playerStats!.reduce((s, p) => s + p.threePA, 0));
  });
});
