import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
it("preserves the pre-game-flow release e8681b9", () => {
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
  delete (run as { gameFlowVersion?: 1 }).gameFlowVersion;
  const teams = createLeague(run);
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  expect(createHash("sha256").update(JSON.stringify(value)).digest("hex")).toBe(
    "54f982c910a9f46aa98caf4b641ad816c7106be76089f8fb938c84db166b527c",
  );
});
