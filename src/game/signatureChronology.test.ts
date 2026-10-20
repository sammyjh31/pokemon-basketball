import { expect, it } from "vitest";
import { performanceRun } from "./seasonPerformance.testUtils";
import { createLeague } from "./league";
import { trainMastery, teamsWithMastery } from "./abilityMastery";
import { comboTrainingFocus } from "./comboPolicy";
import { verifyMasteryChronology } from "./masteryChronology";
import { pairKey, teamsWithChemistry } from "./teammateChemistry";
import type { FranchiseSeason } from "./franchiseTypes";
import type { OffseasonReport } from "./developmentTypes";
it("reconstructs partnership practice from verified final familiarity rather than opening-day bonds", () => {
  const run = { ...performanceRun(), movesetVersion: 2 as const };
  const initial = createLeague(run);
  const xp = Object.fromEntries(
    initial.map((t) => [
      t.id,
      Object.fromEntries(
        Object.values(t.roster).map((id) => [id!, 25 + ((id! * 7) % 250)]),
      ),
    ]),
  );
  const bonds = Object.fromEntries(
    initial.map((t) => {
      const ids = Object.values(t.roster) as number[];
      return [
        t.id,
        Object.fromEntries(
          ids.flatMap((a, i) =>
            ids
              .slice(i + 1)
              .map((b) => [
                pairKey(a, b),
                Math.imul(a, b) % 3 === 0 ? 6000 : 0,
              ]),
          ),
        ),
      ];
    }),
  );
  const without = teamsWithMastery(initial, xp),
    final = teamsWithChemistry(without, bonds);
  const assignments = Object.fromEntries(
    final.flatMap((t) =>
      Object.values(t.roster).map((id) => [
        id!,
        {
          plan: {
            focus: comboTrainingFocus(t, id!)!,
            intensity: "standard" as const,
          },
        },
      ]),
    ),
  );
  const trained = final.map((t) =>
    trainMastery(t, assignments, 1, run.seasonSeed),
  );
  expect(
    trained.some(
      (r, i) =>
        JSON.stringify(r) !==
        JSON.stringify(
          trainMastery(without[i], assignments, 1, run.seasonSeed),
        ),
    ),
  ).toBe(true);
  const history = [
    {
      year: 1,
      seasonSeed: run.seasonSeed,
      replay: {
        teams: initial,
        playoffs: { abilityMastery: xp, chemistryBonds: bonds },
      },
    },
  ] as unknown as FranchiseSeason[];
  const reports = [
    {
      year: 1,
      tradeStart: 0,
      tradeCount: 0,
      players: Object.entries(assignments).map(([id, training]) => ({
        pokemonId: Number(id),
        training,
      })),
      mastery: trained.flatMap((r) => r.changes),
    },
  ] as OffseasonReport[];
  const current = final.map((t, i) => ({
    ...t,
    abilityMastery: trained[i].mastery,
  }));
  expect(() =>
    verifyMasteryChronology(
      run,
      current,
      history,
      [],
      undefined,
      undefined,
      "offseason",
      reports,
    ),
  ).not.toThrow();
  const bad = structuredClone(history);
  bad[0].replay!.playoffs.chemistryBonds = undefined;
  expect(() =>
    verifyMasteryChronology(
      run,
      current,
      bad,
      [],
      undefined,
      undefined,
      "offseason",
      reports,
    ),
  ).toThrow();
});
