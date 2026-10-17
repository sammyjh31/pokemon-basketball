import { expect, it } from "vitest";
import { insightTeams } from "./insightAnalysis.testUtils";
import {
  advanceMorale,
  retainMorale,
  withRosterMorale,
  moraleAssessment,
} from "./playerMorale";
const team = () => ({
  ...retainMorale({
    ...insightTeams[0],
    coach: { version: 1 as const, id: "misty" },
  }),
  personalityVersion: 1 as const,
});
it("personalizes reactions to the same minutes, result and roster move while preserving the old model", () => {
  const t = team(),
    old = { ...t, personalityVersion: undefined },
    boxes = Object.values(t.roster).map((id) => ({
      pokemonId: id!,
      minutes: 10,
    }));
  const modern = advanceMorale(t, boxes, false),
    prior = advanceMorale(old, boxes, false);
  expect(modern).not.toEqual(prior);
  expect(moraleAssessment(t, 1).personality).toBeDefined();
  const roster = { ...t.roster, PG: 9 };
  const donor = { ...t, roster: { ...t.roster, PG: 9 } };
  expect(
    withRosterMorale({ ...t, roster }, t, [t, donor], "trade").morale,
  ).not.toEqual(
    withRosterMorale({ ...old, roster }, old, [old, donor], "trade").morale,
  );
});
