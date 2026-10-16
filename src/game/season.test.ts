import { describe, expect, it } from "vitest";
import { createRun, placePokemon } from "./draft";
import { ROSTER_SLOTS } from "./types";
import { OPPONENTS, SCHEDULE } from "../data/opponents";
import { simulateSeason, winProbability, resolveScore } from "./season";
const full = (seed = 12) => {
  let run = createRun("free", true, seed);
  [65, 150, 149, 68, 143, 9, 94, 59].forEach((id, i) => {
    run = placePokemon(run, id, ROSTER_SLOTS[i]);
  });
  return run;
};
describe("season simulation", () => {
  it("creates 82 games against 29 opponents with balanced home/away", () => {
    expect(OPPONENTS).toHaveLength(29);
    expect(new Set(OPPONENTS.map((o) => o.id)).size).toBe(29);
    expect(SCHEDULE).toHaveLength(82);
    expect(SCHEDULE.filter((g) => g.home)).toHaveLength(41);
    expect(new Set(SCHEDULE.map((g) => g.opponentId)).size).toBe(29);
  });
  it("produces repeatable results, coherent scores, and league-wide awards", () => {
    const run = full();
    const result = simulateSeason(run);
    expect(result).toEqual(simulateSeason(run));
    expect(result.games).toHaveLength(82);
    expect(result.wins + result.losses).toBe(82);
    expect(result.wins).toBe(result.games.filter((g) => g.won).length);
    for (const game of result.games) {
      expect(game.teamScore).not.toBe(game.opponentScore);
      expect(game.won).toBe(game.teamScore > game.opponentScore);
      for (const score of [game.teamScore, game.opponentScore]) {
        expect(Number.isInteger(score)).toBe(true);
        expect(score).toBeGreaterThanOrEqual(0);
      }
      expect(
        result.league!.players.some(
          (p) =>
            p.pokemonId === game.playerOfGameId &&
            p.teamId === game.playerOfGameTeamId,
        ),
      ).toBe(true);
    }
    expect(result.league!.awards[0].pokemonId).toBe(result.mvpId);
  }, 120000);
  it("improves odds monotonically with either offense or defense", () => {
    for (const opponent of OPPONENTS) {
      const team = {
        offense: 50,
        defense: 50,
        overall: 50,
        filled: 5,
        complete: true,
      };
      const p = winProbability(team, opponent, false);
      expect(p).toBeGreaterThan(0);
      expect(p).toBeLessThan(1);
      expect(
        winProbability({ ...team, offense: 60 }, opponent, false),
      ).toBeGreaterThanOrEqual(p);
      expect(
        winProbability({ ...team, defense: 60 }, opponent, false),
      ).toBeGreaterThanOrEqual(p);
      expect(winProbability(team, opponent, true)).toBeGreaterThan(p);
    }
  });
  it("preserves the legacy tie resolver for original save validation", () => {
    for (const won of [true, false]) {
      const score = resolveScore(100, 100, won, 2);
      expect(score.overtime).toBe(true);
      expect(score.teamScore > score.opponentScore).toBe(won);
      expect(Math.min(score.teamScore, score.opponentScore)).toBeGreaterThan(
        100,
      );
    }
  });
  it("rejects incomplete and already completed runs", () => {
    expect(() => simulateSeason(createRun("spin", true, 1))).toThrow();
    const run = full();
    run.result = simulateSeason(run);
    expect(() => simulateSeason(run)).toThrow();
  });
});
