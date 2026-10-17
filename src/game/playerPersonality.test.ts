import { expect, it } from "vitest";
import {
  playerPersonality,
  personalityReactions,
  teamLeadership,
  captainMoraleSupport,
} from "./playerPersonality";
import { retainMorale } from "./playerMorale";
import { insightTeams } from "./insightAnalysis.testUtils";
const team = () => ({
  ...retainMorale({
    ...insightTeams[0],
    coach: { version: 1 as const, id: "ash" },
  }),
  personalityVersion: 1 as const,
  chemistryBonds: {},
});
it("gives every species a stable bounded personality without using match RNG", () => {
  const profiles = Array.from({ length: 1025 }, (_, i) =>
    playerPersonality(i + 1),
  );
  expect(new Set(profiles.map((p) => p.archetype)).size).toBeGreaterThanOrEqual(
    5,
  );
  for (const p of profiles)
    for (const key of [
      "ambition",
      "loyalty",
      "resilience",
      "coachability",
      "leadership",
    ] as const)
      expect(p[key] >= 20 && p[key] <= 90).toBe(true);
  expect(playerPersonality(25)).toBe(playerPersonality(25));
  expect(Object.isFrozen(playerPersonality(25))).toBe(true);
  expect(playerPersonality(25)).not.toEqual(playerPersonality(26));
  expect(() => playerPersonality(0)).toThrow();
});
it("makes ambition, loyalty, resilience and trainer compatibility affect reaction coefficients", () => {
  const t = team();
  const ids = Array.from({ length: 100 }, (_, i) => i + 1);
  const ranked = ids.sort(
    (a, b) => playerPersonality(a).ambition - playerPersonality(b).ambition,
  );
  expect(
    personalityReactions(t, ranked.at(-1)!).minutesSensitivity,
  ).toBeGreaterThan(personalityReactions(t, ranked[0]).minutesSensitivity);
  expect(
    personalityReactions({ ...t, personalityVersion: undefined }, 1)
      .minutesSensitivity,
  ).toBe(1);
  expect(
    ids.some(
      (id) =>
        personalityReactions(t, id).coachCompatibility !==
        personalityReactions({ ...t, coach: { version: 1, id: "brock" } }, id)
          .coachCompatibility,
    ),
  ).toBe(true);
});
it("automatically selects one captain independent of slot labels and daily mood and replaces departures", () => {
  const t = team(),
    leader = teamLeadership(t)!;
  expect(Object.values(t.roster)).toContain(leader.captainId);
  const shuffled = {
    ...t,
    roster: { ...t.roster, PG: t.roster.B3, B3: t.roster.PG },
  };
  expect(teamLeadership(shuffled)).toEqual(leader);
  const unhappy = {
    ...t,
    morale: Object.fromEntries(
      Object.entries(t.morale).map(([id, p]) => [id, { ...p, score: 5 }]),
    ),
  };
  expect(teamLeadership(unhappy)!.captainId).toBe(leader.captainId);
  expect(teamLeadership(unhappy)!.moraleSupport).toBeLessThan(
    leader.moraleSupport,
  );
  const slot = Object.keys(t.roster).find(
    (s) => t.roster[s as keyof typeof t.roster] === leader.captainId,
  )!;
  const changed = { ...t, roster: { ...t.roster, [slot]: 252 } };
  expect(teamLeadership(changed)!.captainId).not.toBe(leader.captainId);
  expect(
    teamLeadership({ ...t, personalityVersion: undefined }),
  ).toBeUndefined();
  expect(
    teamLeadership({ ...t, roster: { ...t.roster, B3: null } }),
  ).toBeUndefined();
  expect(captainMoraleSupport(t, leader.captainId)).toBe(0);
  for (const id of Object.values(t.roster))
    expect(Math.abs(captainMoraleSupport(t, id!))).toBeLessThanOrEqual(3);
  expect(Math.abs(leader.cohesionBonus)).toBeLessThanOrEqual(2);
});
