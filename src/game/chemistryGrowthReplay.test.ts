import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";

it("preserves the chemistry enabled coached draft and matches from release e5582dc", () => {
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
  delete (run as { chemistryGrowthVersion?: 1 }).chemistryGrowthVersion;
  delete run.moraleVersion;
  delete run.personalityVersion;
  const teams = createLeague(run);
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex");
  expect(hash).toBe(
    "836b9fbad82c1f6b51e1cf12bd1a2fbb55c05ee1f74bbdf02f523d6078f544b4",
  );
});
