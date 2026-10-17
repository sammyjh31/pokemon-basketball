import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
it("preserves the pre-morale release 02b6586", () => {
  const run = {
    ...createRun("free", true, 22),
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
  delete (run as { moraleVersion?: 1 }).moraleVersion;
  delete run.personalityVersion;
  const teams = createLeague(run);
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  expect(createHash("sha256").update(JSON.stringify(value)).digest("hex")).toBe(
    "3ff0f3598018d5e0829bbbc8374595bedf6c819d0e8f945c9ccbd3b4784a2abb",
  );
});
