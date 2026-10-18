import { createHash } from "node:crypto";
import { expect, it } from "vitest";
import { simulateSeason } from "./season";
import { performanceRun } from "./seasonPerformance.testUtils";

it("keeps every game, player total, award and evolving team bank identical through a full v4 season", () => {
  const result = simulateSeason(performanceRun());
  expect(result.league!.games).toHaveLength(1230);
  expect(
    createHash("sha256").update(JSON.stringify(result)).digest("hex"),
  ).toBe("25611d732e06cd9650af0570a4164bc8bdd4350e20f818678324a8a6e97c9f47");
}, 300000);
