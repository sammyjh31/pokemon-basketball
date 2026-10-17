import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";

it("preserves the evaluation-enabled draft and matches from release 84925c0", () => {
  const run = {
    ...createRun("free", true, 22),
    coach: { version: 1 as const, id: "misty" },
    courtVersion: 1 as const,
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
  delete (run as { physicalAbilityVersion?: 1 }).physicalAbilityVersion;
  delete run.chemistryVersion;
  delete run.chemistryGrowthVersion;
  delete run.moraleVersion;
  delete run.personalityVersion;
  delete (run as { gameFlowVersion?: 1 }).gameFlowVersion;
  const teams = createLeague(run);
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  expect(hash).toBe(
    "46a2bf40c70d72697fcfe24ec498618a50c183b0928eca380cd651cf5219b646",
  );
});
