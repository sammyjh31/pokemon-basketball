import { createHash } from "node:crypto";
import { it, expect } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";

it("preserves the evaluation and physical enabled coached draft and matches from release ec43701", () => {
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
  delete (run as { chemistryVersion?: 1 }).chemistryVersion;
  delete (run as { chemistryGrowthVersion?: 1 }).chemistryGrowthVersion;
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
    "dd8e56f5465aed4601f729c03232c84d00d1ec466437c20ab24680294fe71049",
  );
});
