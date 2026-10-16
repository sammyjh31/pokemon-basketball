import { expect, it } from "vitest";
import { createGame } from "./setup";
import { giveBall, releaseShot, attemptSteal } from "./actions";
const roster = (n: number) => ({
  PG: n,
  SG: n + 1,
  SF: n + 2,
  PF: n + 3,
  C: n + 4,
  B1: n + 5,
  B2: n + 6,
  B3: n + 7,
});
function scenario(defenderId: number, typed = true) {
  const s = createGame({
    teams: [
      { name: "A", roster: roster(1) },
      { name: "B", roster: roster(20) },
    ],
    seed: 42,
    official: true,
    ...(typed ? { typeMatchupsVersion: 1 as const } : {}),
  });
  s.phase = "live";
  const p = s.players[0],
    defender = s.players[8];
  p.pokemonId = 25; // Electric shooter; attributes held constant across comparisons.
  p.x = 23;
  p.y = 7.5;
  for (const d of s.players.filter((p) => p.team === 1)) {
    d.x = 2;
    d.y = 2;
  }
  defender.pokemonId = defenderId;
  defender.x = 24;
  defender.y = 7.5;
  giveBall(s, p);
  return s;
}
it("applies dual-type matchups to contested arcade shots but leaves old official rules intact", () => {
  const makes = (defenderId: number, typed = true, open = false) => {
    const base = scenario(defenderId, typed);
    if (open) base.players[8].x = 2;
    let result = 0;
    for (let n = 1; n <= 400; n++) {
      const s = structuredClone(base);
      s.seed = n * 99991;
      releaseShot(s, s.players[0], 0.65);
      result += Number(s.ball.made);
    }
    return result;
  };
  expect(makes(130)).toBeGreaterThan(makes(95)); // Water/Flying versus Rock/Ground.
  expect(makes(130, false)).toBe(makes(95, false));
  expect(makes(130, true, true)).toBe(makes(95, true, true));
});
it("rewards an advantageous steal matchup while keeping distance and cooldown rules", () => {
  const steals = (defenderId: number) => {
    const base = scenario(defenderId);
    base.players[0].pokemonId = 7; // Water carrier.
    let result = 0;
    for (let n = 1; n <= 400; n++) {
      const s = structuredClone(base);
      s.seed = n * 99991;
      attemptSteal(s, s.players[8]);
      result += Number(s.ball.owner === 8);
    }
    return result;
  };
  expect(steals(25)).toBeGreaterThan(steals(4)); // Electric pressure versus resisted Fire.
});
