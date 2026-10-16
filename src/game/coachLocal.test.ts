import { expect, it } from "vitest";
import { rookieFixture } from "./rookieDraft.testUtils";
import { assignLeagueCoaches } from "./trainerCoaches";
import { reviewLocalCoaches } from "./coachLocal";
import type { LocalLeague } from "./localLeague";
it("retains CPU coaches when a legacy offseason has no evidence of the runner-up", () => {
  const f = rookieFixture().franchise!;
  const teams = assignLeagueCoaches(
    f.teams,
    21,
    new Map([[0, { version: 1, id: "ash" }]]),
  );
  const draft = {
    managers: [{ teamId: 0, name: "You" }],
    career: {
      version: 1,
      phase: "offseason",
      year: 1,
      teams,
      history: [{ ...f.history[0], teams }],
    },
  } as unknown as LocalLeague;
  const reviewed = reviewLocalCoaches(draft);
  expect(reviewed.career!.coachOffice!.years[0].changes).toEqual([]);
  expect(reviewed.career!.coachOffice!.years[0].cpuProcessed).toBe(true);
  expect(reviewLocalCoaches(reviewed)).toBe(reviewed);
});
