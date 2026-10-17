import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
it("preserves the pre-evaluation coached ability draft and matches", () => {
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
  delete (run as { evaluationVersion?: 1 }).evaluationVersion;
  const teams = createLeague(run);
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  expect(hash).toBe(
    "dbe264bc7ab12e412177d397922d3a0f03f31383bbf820b2f7cc64c6d78750a0",
  );
});
