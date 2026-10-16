import { expect, it } from "vitest";
import { createLeague } from "./league";
import { createRun } from "./draft";
import { POKEMON_BY_ID } from "../data/pokemon";
import { bestPosition, positionRating } from "./ratings";
import { POSITIONS } from "./types";
it("distributes AI franchise players across suitable starting roles", () => {
  const roles = new Set<string>();
  let fitLoss = 0;
  for (const seed of [11, 42, 87]) {
    const teams = createLeague({
      ...createRun("free", false, seed),
      roster: {
        PG: 65,
        SG: 135,
        SF: 149,
        PF: 68,
        C: 143,
        B1: 121,
        B2: 6,
        B3: 131,
      },
    });
    for (const team of teams.slice(1)) {
      const star = POSITIONS.map((slot) => ({
        slot,
        mon: POKEMON_BY_ID.get(team.roster[slot]!)!,
      })).sort(
        (a, b) =>
          positionRating(b.mon, bestPosition(b.mon)) -
          positionRating(a.mon, bestPosition(a.mon)),
      )[0];
      roles.add(star.slot);
      fitLoss +=
        positionRating(star.mon, bestPosition(star.mon)) -
        positionRating(star.mon, star.slot);
    }
  }
  expect(roles.size).toBeGreaterThanOrEqual(4);
  expect(fitLoss / 87).toBeLessThan(4);
});
