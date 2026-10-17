import { expect, it } from "vitest";
import { masteryFactor, masteryLevel } from "./masteryMath";
import { insightTeams } from "./insightAnalysis.testUtils";
import {
  advanceMastery,
  applyMasterySnapshot,
  initialMasteryBanks,
  masteryGameReport,
  masteryMilestones,
  recordMasteryGame,
  retainMastery,
  snapshotMastery,
  trainMastery,
  validateMasteryRoster,
  withRosterMastery,
} from "./abilityMastery";
import { speciesAbility } from "./abilities";
const team = (index = 0) =>
  retainMastery({
    ...insightTeams[index],
    abilityVersion: 1 as const,
    personalityVersion: 1 as const,
    coach: { version: 1 as const, id: "misty" },
  });
const boxes = (t: ReturnType<typeof team>, minutes = 30) =>
  (Object.values(t.roster) as number[]).map((pokemonId) => ({
    pokemonId,
    minutes,
    abilityActivations: {
      offense: 10,
      support: 2,
      defense: 4,
      physical: { movement: 100, screens: 4, rebounds: 5, energySaved: 20 },
    },
  }));
it("provides monotonic capped mastery tiers without changing base ability effects at zero", () => {
  expect(masteryLevel(0).name).toBe("Developing");
  expect(masteryLevel(75).name).toBe("Practiced");
  expect(masteryLevel(200).name).toBe("Skilled");
  expect(masteryLevel(400).name).toBe("Expert");
  expect(masteryLevel(700).name).toBe("Master");
  expect(masteryLevel(1000).next).toBeNull();
  expect(masteryFactor(0)).toBe(1);
  expect(masteryFactor(1000)).toBeCloseTo(1.2);
  expect(masteryFactor(Infinity)).toBe(1);
  for (let xp = 1; xp <= 1000; xp++)
    expect(masteryFactor(xp)).toBeGreaterThanOrEqual(masteryFactor(xp - 1));
});
it("earns bounded experience from real minutes and use, ignores bench and disabled abilities, and normalizes overtime", () => {
  const t = team(),
    id = t.roster.PG!;
  const base = advanceMastery(t, boxes(t));
  expect(base[id]).toBeGreaterThan(0);
  expect(base[id]).toBeLessThanOrEqual(1.5);
  expect(advanceMastery(t, boxes(t, 0))[id]).toBe(0);
  expect(
    advanceMastery({ ...t, engineRules: { abilities: false } }, boxes(t))[id],
  ).toBe(0);
  const less = boxes(t).map((b) => ({ ...b, abilityActivations: undefined }));
  expect(advanceMastery(t, less)[id]).toBeLessThan(base[id]);
  expect(
    advanceMastery(
      t,
      less.map((b) => ({ ...b, minutes: 33.125 })),
      1,
    )[id],
  ).toBe(advanceMastery(t, less)[id]);
  t.abilityMastery[id] = 999.99;
  expect(advanceMastery(t, boxes(t))[id]).toBe(1000);
  expect(() => advanceMastery(t, boxes(t).slice(1))).toThrow();
  expect(() => advanceMastery(t, boxes(t, -1))).toThrow();
});
it("freezes species-owned state and reports milestones without mutating pregame teams", () => {
  const h = team(),
    a = team(1),
    id = h.roster.PG!;
  h.abilityMastery[id] = 74.99;
  const frozen = snapshotMastery(h, a)!,
    before = JSON.stringify([h, a]);
  expect(frozen.home).toHaveLength(8);
  const match = { homeBox: boxes(h), awayBox: boxes(a), overtimePeriods: 0 };
  const report = masteryGameReport(h, a, match)!;
  expect(report.home.find((p) => p.pokemonId === id)!.levelAfter).toBe(
    "Practiced",
  );
  expect(masteryMilestones(h, a, match)).toEqual([
    expect.objectContaining({
      teamId: h.id,
      pokemonId: id,
      levelAfter: "Practiced",
    }),
  ]);
  const banks = initialMasteryBanks([h, a])!;
  recordMasteryGame(banks, h, a, match);
  expect(banks[h.id][id]).toBeGreaterThan(75);
  expect(JSON.stringify([h, a])).toBe(before);
  h.abilityMastery[id] = 800;
  expect(applyMasterySnapshot(h, frozen.home).abilityMastery![id]).toBe(74.99);
  for (const raw of [
    {},
    { ...h.abilityMastery, [id]: 1001 },
    { ...h.abilityMastery, [id]: NaN },
    { ...h.abilityMastery, [id]: 1.001 },
  ])
    expect(() => validateMasteryRoster(raw, h)).toThrow();
  expect(() =>
    snapshotMastery(h, { ...a, abilityMasteryVersion: undefined }),
  ).toThrow();
});
it("carries experience through trades and years, restores released free agents, and initializes rookies independently", () => {
  const a = team(),
    b = team(1),
    id = a.roster.PG!;
  a.abilityMastery[id] = 435.2;
  const moved = withRosterMastery(
    { ...b, roster: { ...b.roster, PG: id } },
    b,
    [a, b],
    "trade",
  );
  expect(moved.abilityMastery![id]).toBe(435.2);
  expect(moved.abilityMastery![b.roster.PG!]).toBeUndefined();
  expect(Object.keys(moved.abilityMastery!)).toHaveLength(8);
  expect(retainMastery(moved).abilityMastery[id]).toBe(435.2);
  expect(
    withRosterMastery(
      { ...b, roster: { ...b.roster, PG: 252 } },
      b,
      [a, b],
      "rookie",
    ).abilityMastery![252],
  ).toBe(0);
  expect(
    withRosterMastery(
      { ...b, roster: { ...b.roster, PG: id } },
      b,
      [b],
      "free-agent",
      { [id]: 435.2 },
    ).abilityMastery![id],
  ).toBe(435.2);
  expect(
    retainMastery({ ...a, abilityMasteryVersion: undefined }).abilityMastery[
      id
    ],
  ).toBe(0);
});
it("uses reproducible coach-selected training, rewards aligned practice, and records its explanation", () => {
  const t = team(),
    id = t.roster.PG!,
    focus = speciesAbility(id).training;
  const aligned = { [id]: { plan: { focus, intensity: "standard" as const } } },
    other = {
      [id]: {
        plan: { focus: "balanced" as const, intensity: "standard" as const },
      },
    };
  const a = trainMastery(t, aligned, 1, 323),
    b = trainMastery(t, other, 1, 323);
  expect(a).toEqual(trainMastery(t, aligned, 1, 323));
  expect(a.mastery[id]).toBeGreaterThan(b.mastery[id]);
  expect(a.changes).toHaveLength(8);
  expect(a.changes[0].reasons.length).toBeGreaterThan(0);
  expect(a.changes.every((p) => p.gained >= 0 && p.gained <= 65)).toBe(true);
  expect(t.abilityMastery[id]).toBe(0);
  expect(
    trainMastery({ ...t, engineRules: { abilities: false } }, aligned, 1, 323)
      .mastery,
  ).toEqual(t.abilityMastery);
});
