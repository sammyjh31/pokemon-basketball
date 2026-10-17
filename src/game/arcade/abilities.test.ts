import { describe, expect, it } from "vitest";
import { advanceBall, giveBall, makePass, releaseShot } from "./actions";
import { createGame } from "./setup";

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
function scenario(enabled = true) {
  const state = createGame({
    teams: [
      { name: "A", roster: roster(1) },
      { name: "B", roster: roster(20) },
    ],
    seed: 22,
    ...(enabled ? { abilityVersion: 1 as const } : {}),
  });
  state.phase = "live";
  for (const player of state.players) {
    player.x = 2;
    player.y = 2;
    for (const key of Object.keys(player.attributes))
      player.attributes[key as keyof typeof player.attributes] = 50;
  }
  const shooter = state.players[0];
  shooter.x = 24;
  shooter.y = 7.5;
  giveBall(state, shooter);
  return state;
}

describe("arcade species abilities", () => {
  it("counts only the probability changes applied at the shot caps, in role order", () => {
    const state = scenario();
    const shooter = state.players[0],
      defender = state.players[8];
    shooter.pokemonId = 68;
    shooter.x = 24.5;
    shooter.attributes.finishing = 100;
    state.fire[0] = 10;
    state.seed = 109; // .930556: the capped shooter boost cannot cancel Intimidate.
    defender.pokemonId = 130;
    defender.x = 25.5;
    defender.y = 7.5;
    releaseShot(state, shooter, 0.65, true);
    expect(shooter.stats.abilityActivations?.offense).toBe(0);
    expect(defender.stats.abilityActivations?.defense).toBe(1);
    expect(state.ball.made).toBe(false);

    const floor = scenario();
    floor.players[0].pokemonId = 486; // Slow Start cannot lower a .04 chance further.
    floor.players[0].energy = 0;
    floor.players[0].x = 1;
    releaseShot(floor, floor.players[0], 0.65);
    expect(floor.players[0].stats.abilityActivations?.offense).toBe(0);
  });
  it("changes an eligible shot's probability, counts once and preserves the legacy random sequence", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      state.players[0].energy = 55; // Overgrow: .600 base chance becomes .625.
      releaseShot(state, state.players[0], 0.65);
      releaseShot(state, state.players[0], 0.65);
    }
    expect(enabled.ball.made).toBe(true); // Seed 22 draws .621868...
    expect(legacy.ball.made).toBe(false);
    expect(enabled.seed).toBe(legacy.seed);
    expect(enabled.players[0].stats.fga).toBe(1);
    expect(enabled.players[0].stats.abilityActivations).toEqual({
      offense: 1,
      support: 0,
      defense: 0,
    });
    expect(enabled.players[7].stats.abilityActivations).toEqual({
      offense: 0,
      support: 0,
      defense: 0,
    });
    expect(legacy).not.toHaveProperty("abilityVersion");
    expect(legacy.players[0].stats).not.toHaveProperty("abilityActivations");
  });

  it("does not count ineligible conditions or a shot rejected by cooldown", () => {
    const state = scenario();
    releaseShot(state, state.players[0], 0.65);
    expect(state.players[0].stats.abilityActivations?.offense).toBe(0);
    giveBall(state, state.players[0]);
    state.players[0].energy = 50;
    releaseShot(state, state.players[0], 0.65);
    expect(state.players[0].stats.fga).toBe(1);
    expect(state.players[0].stats.abilityActivations?.offense).toBe(0);
  });

  it("applies one nearest defender's ability only within the actual contest radius", () => {
    const enabled = scenario(),
      legacy = scenario(false);
    for (const state of [enabled, legacy]) {
      state.seed = 6; // .525746 lies between .529130 base and .509130 with Intimidate.
      state.players[0].x = 22.5;
      state.players[8].pokemonId = 130;
      state.players[8].x = 23.5;
      state.players[8].y = 7.5;
      releaseShot(state, state.players[0], 0.65);
    }
    expect(enabled.ball.made).toBe(false);
    expect(legacy.ball.made).toBe(true);
    expect(enabled.players[8].stats.abilityActivations?.defense).toBe(1);
    const open = scenario();
    open.players[8].pokemonId = 130;
    open.players[8].x = 21.5; // 2.5m: type influence can exist, but no shot contest.
    open.players[8].y = 7.5;
    releaseShot(open, open.players[0], 0.65);
    expect(open.players[8].stats.abilityActivations?.defense).toBe(0);
  });

  it.each([0, 3.01])(
    "uses only a recent completed pass for a creator's spot-up bonus (age %s)",
    (age) => {
      const state = scenario();
      const shooter = state.players[0],
        passer = state.players[1];
      shooter.x = 20.5;
      passer.pokemonId = 65; // Synchronize supports a real spot-up catch.
      passer.x = 17;
      passer.y = 7.5;
      giveBall(state, passer);
      makePass(state, passer, shooter);
      state.elapsed = 1;
      advanceBall(state, 1);
      expect(state.ball.owner).toBe(shooter.id);
      state.elapsed += age;
      state.seed = 22; // .618 base chance; a fresh pass raises it to .638.
      releaseShot(state, shooter, 0.65);
      expect(state.ball.made).toBe(age === 0);
      expect(passer.stats.abilityActivations?.support).toBe(age === 0 ? 1 : 0);
    },
  );

  it("does not invent a passer or a spot-up from a moving ball handler", () => {
    const state = scenario();
    state.players[1].pokemonId = 65;
    state.lastPass = { from: 0, to: 0, time: 0 };
    state.players[0].pokemonId = 65;
    releaseShot(state, state.players[0], 0.65);
    expect(state.players[0].stats.abilityActivations?.support).toBe(0);
    const moving = scenario();
    moving.players[1].pokemonId = 65;
    moving.players[0].x = 20.5;
    giveBall(moving, moving.players[1]);
    makePass(moving, moving.players[1], moving.players[0]);
    advanceBall(moving, 2);
    moving.players[0].vx = 4;
    releaseShot(moving, moving.players[0], 0.65);
    expect(moving.players[1].stats.abilityActivations?.support).toBe(0);
  });

  it("activates Pickup after a real offensive rebound, then clears it on a possession change", () => {
    const state = scenario();
    const shooter = state.players[0];
    shooter.pokemonId = 52;
    state.ball.mode = "loose";
    state.ball.owner = null;
    state.ball.reboundOf = 0;
    state.ball.x = shooter.x;
    state.ball.y = shooter.y;
    state.ball.z = 0;
    advanceBall(state, 0.02);
    state.seed = 91; // .665264: .645 without Pickup, .670 with it.
    releaseShot(state, shooter, 0.65);
    expect(state.ball.made).toBe(true);
    expect(shooter.stats.abilityActivations?.offense).toBe(1);
    giveBall(state, state.players[8]);
    giveBall(state, shooter);
    shooter.cooldown = 0;
    state.seed = 91;
    releaseShot(state, shooter, 0.65);
    expect(state.ball.made).toBe(false);
    expect(shooter.stats.abilityActivations?.offense).toBe(1);
  });

  it.each([0, 3.01])(
    "uses actual defensive rebound timing for transition abilities (age %s)",
    (age) => {
      const state = scenario();
      const shooter = state.players[0];
      shooter.pokemonId = 84;
      state.possession = 1;
      state.ball.mode = "loose";
      state.ball.owner = null;
      state.ball.reboundOf = 1;
      state.ball.x = shooter.x;
      state.ball.y = shooter.y;
      state.ball.z = 0;
      advanceBall(state, 0.02);
      state.elapsed += age;
      releaseShot(state, shooter, 0.65);
      expect(shooter.stats.abilityActivations?.offense).toBe(age === 0 ? 1 : 0);
    },
  );
});
