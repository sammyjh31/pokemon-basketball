import { expect, it } from "vitest";
import { createGame } from "./setup";
import { continuePeriod, queueSubstitution } from "./engine";
import { activePlayers } from "./helpers";
import { POSITIONS } from "../types";

function scenario(typed = true) {
  const s = createGame({
    teams: [
      {
        name: "Human",
        roster: { PG: 7, SG: 8, SF: 9, PF: 54, C: 55, B1: 27, B2: 28, B3: 50 },
      },
      {
        name: "CPU",
        roster: {
          PG: 52,
          SG: 53,
          SF: 108,
          PF: 113,
          C: 143,
          B1: 25,
          B2: 134,
          B3: 126,
        },
      },
    ],
    seed: 42,
    ...(typed ? { typeMatchupsVersion: 1 as const } : {}),
  });
  // Hold basketball ability constant while exercising real inbound/substitution code.
  for (const p of s.players) {
    for (const key of Object.keys(
      p.attributes,
    ) as (keyof typeof p.attributes)[])
      p.attributes[key] = 70;
    p.energy = 100;
    p.active = p.id % 8 < 5;
    p.slot = POSITIONS[(p.id % 8) % 5];
  }
  s.phase = "break";
  return s;
}

it("makes a type counter substitution at a dead ball even when starters are fresh", () => {
  const s = scenario();
  continuePeriod(s);
  expect(s.players[13].active).toBe(true); // Pikachu versus Water.
  expect(activePlayers(s, 1)).toHaveLength(5);
  expect(new Set(activePlayers(s, 1).map((p) => p.slot)).size).toBe(5);
  expect(activePlayers(s, 0).map((p) => p.id)).toEqual([0, 1, 2, 3, 4]);
  expect(s.events.filter((e) => e.kind === "sub" && e.team === 1)).toHaveLength(
    1,
  );
});

it("responds to the human's queued counter before choosing its own substitute", () => {
  const s = scenario();
  continuePeriod(s);
  const electric = s.players[13];
  expect(electric.active).toBe(true);
  // Ground lineups stop Electric. Queue the final slot change at the same dead ball.
  for (const p of activePlayers(s, 0))
    if (p.slot !== electric.slot) p.pokemonId = 28;
  const target = activePlayers(s, 0).find((p) => p.slot === electric.slot)!;
  expect(queueSubstitution(s, target.id, 5)).toBe(true);
  s.elapsed = 20;
  s.phase = "break";
  continuePeriod(s);
  expect(electric.active).toBe(false);
  expect(s.players[5].active).toBe(true);
  expect(s.players[14].active).toBe(true); // Vaporeon counters the new Ground five.
});

it("does not thrash substitutions at consecutive dead balls or play an exhausted counter", () => {
  const s = scenario();
  continuePeriod(s);
  const five = activePlayers(s, 1).map((p) => p.id);
  s.elapsed = 1;
  s.phase = "break";
  continuePeriod(s);
  expect(activePlayers(s, 1).map((p) => p.id)).toEqual(five);
  const tired = scenario();
  tired.players[13].energy = 0;
  tired.players[15].energy = 0;
  continuePeriod(tired);
  expect(tired.players[13].active).toBe(false);
  expect(tired.players[15].active).toBe(false);
});

it("preserves fatigue-only substitutions in historical arcade games", () => {
  const s = scenario(false);
  continuePeriod(s);
  expect(activePlayers(s, 1).map((p) => p.id)).toEqual([8, 9, 10, 11, 12]);
});

it("allows urgent rest during the counter-substitution cooldown", () => {
  const s = scenario();
  continuePeriod(s);
  const exhausted = activePlayers(s, 1).find((p) => p.id !== 13)!;
  exhausted.energy = 0;
  s.elapsed = 1;
  s.phase = "break";
  continuePeriod(s);
  expect(exhausted.active).toBe(false);
  expect(activePlayers(s, 1)).toHaveLength(5);
});
