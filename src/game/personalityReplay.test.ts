import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createRun } from "./draft";
import { createLeague } from "./league";
import { simulateMatch } from "./match";
it("preserves morale-enabled release e8681b9", () => {
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
  delete run.abilityMasteryVersion;
  delete (run as { personalityVersion?: 1 }).personalityVersion;
  const teams = createLeague(run);
  for (const [i, p] of Object.values(teams[0].morale!).entries())
    Object.assign(p, {
      score: 30 + i * 7,
      minutes: 15 + i * 3,
      success: 60,
      disruption: -2,
      games: 18,
    });
  const value = {
    teams,
    games: [1, 42, 400].map((seed) => simulateMatch(teams[0], teams[1], seed)),
  };
  expect(createHash("sha256").update(JSON.stringify(value)).digest("hex")).toBe(
    "6d8594defd3eba4abea8fa084e5ef0d4495e687eeca5b68593ccea433146c2ff",
  );
});
