import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
it("preserves the pre-game-flow release 41622c9", () => {
  const run = {
    ...createRun("free", true, 22),
    courtVersion: 2 as const,
    abilityMasteryVersion: undefined,
    coach: { version: 1 as const, id: "misty" },
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
  };
  delete (run as { gameFlowVersion?: 1 }).gameFlowVersion;
  const teams = createLeague(run);
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  expect(createHash("sha256").update(JSON.stringify(value)).digest("hex")).toBe(
    "3fed7dc0537f8a435dd2f9d4be9fba08c8478cb6cdb0ae2321bcf1cd753472be",
  );
});
