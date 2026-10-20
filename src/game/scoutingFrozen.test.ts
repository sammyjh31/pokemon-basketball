import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { createLeague } from "./league";
import { performanceRun } from "./seasonPerformance.testUtils";
import { simulateMatch } from "./match";
it("preserves unseeded v3 counter match behavior", () => {
  const teams = createLeague({ ...performanceRun(), movesetVersion: 3 });
  for (const team of teams)
    team.abilityMastery = Object.fromEntries(
      Object.values(team.roster).map((id) => [id, 400]),
    );
  expect(
    createHash("sha256")
      .update(JSON.stringify(simulateMatch(teams[0], teams[1], 1982)))
      .digest("hex"),
  ).toBe("d2ca92fd850351e1d703832f5a584e98a80296d402d2bd8dbf03f342d57442c8");
});
