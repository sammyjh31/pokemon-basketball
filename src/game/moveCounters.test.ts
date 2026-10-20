import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { simulateMatch } from "./match";

it("preserves a frozen signature/combo v2 full match", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 2 });
  for (const team of teams)
    team.abilityMastery = Object.fromEntries(
      Object.values(team.roster).map((id) => [id, 400]),
    );
  const match = simulateMatch(teams[0], teams[1], 1982);
  expect(createHash("sha256").update(JSON.stringify(match)).digest("hex")).toBe(
    "7fe4e0361617b96cb95abbed7a5ff52485648d2d3ecc3d8dae84312b2e480088",
  );
});
