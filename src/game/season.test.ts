import { describe, expect, it } from "vitest";
import { createRun, placePokemon } from "./draft";
import { POSITIONS } from "./types";
import { OPPONENTS, SCHEDULE } from "../data/opponents";
import { simulateSeason, winProbability, resolveScore } from "./season";
import { nextRandom } from "./random";
const full = (seed = 12) => {
  let run = createRun("free", true, seed);
  [65, 150, 149, 68, 143].forEach((id, i) => {
    run = placePokemon(run, id, POSITIONS[i]);
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
  it("produces repeatable results, coherent scores, and roster-only awards", () => {
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
      expect(Object.values(run.roster)).toContain(game.playerOfGameId);
    }
    expect(Object.values(run.roster)).toContain(result.mvpId);
  });
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
  it("gives stronger teams more wins across 500 shared random seasons", () => {
    let weak = 0,
      strong = 0;
    for (let seed = 0; seed < 500; seed++) {
      let state = seed;
      for (const match of SCHEDULE) {
        const roll = nextRandom(state);
        state = roll.seed;
        const opp = OPPONENTS.find((o) => o.id === match.opponentId)!;
        weak += Number(
          roll.value <
            winProbability(
              {
                offense: 30,
                defense: 30,
                overall: 30,
                filled: 5,
                complete: true,
              },
              opp,
              match.home,
            ),
        );
        strong += Number(
          roll.value <
            winProbability(
              {
                offense: 75,
                defense: 75,
                overall: 75,
                filled: 5,
                complete: true,
              },
              opp,
              match.home,
            ),
        );
      }
    }
    expect(strong).toBeGreaterThan(weak);
  });
  it("resolves ties in overtime according to the sampled winner", () => {
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
