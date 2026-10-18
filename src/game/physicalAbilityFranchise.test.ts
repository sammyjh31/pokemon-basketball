import { expect, it } from "vitest";
import { validateFranchise } from "./franchiseValidation";
import { createRun } from "./draft";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { prepareGameLoad } from "./persistence";

it.each([false, true])(
  "restores physical season, playoff and career totals and advances without changing the archive (earned history: %s)",
  async (earnedHistory) => {
    const run = createRun("free", true, 822);
    if (!earnedHistory) {
      delete run.abilityMasteryVersion;
      delete run.chemistryGrowthVersion;
      delete run.moraleVersion;
      delete run.personalityVersion;
    }
    const initial = {
      ...initialState(822),
      run: {
        ...run,
        coach: { version: 1 as const, id: "misty" },
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
      },
    };
    const result = simulateSeason(initial.run);
    const season = gameReducer(initial, {
      type: "APPLY_SEASON",
      source: initial.run,
      result,
    });
    const playoffs = simulatePlayoffs(result.league!, initial.run.seasonSeed);
    const archived = processOffseason(
      archiveFranchiseSeason({ ...season, run: { ...season.run, playoffs } }),
    );
    expect(
      archived.franchise!.teams.every((t) => t.physicalAbilityVersion === 1),
    ).toBe(true);
    const regular = archived.franchise!.history[0].replay!.regularPlayers;
    const playoff = archived.franchise!.history[0].replay!.playoffPlayers;
    expect(
      regular.some(
        (player) => (player.abilityActivations?.physical?.movement ?? 0) > 0,
      ),
    ).toBe(true);
    expect(
      playoff.some(
        (player) => (player.abilityActivations?.physical?.energySaved ?? 0) > 0,
      ),
    ).toBe(true);
    for (const player of regular) {
      expect(
        archived.franchise!.careers.find(
          (career) => career.pokemonId === player.pokemonId,
        )!.regular.abilityActivations,
      ).toEqual(player.abilityActivations);
    }
    const prepared = prepareGameLoad(
      { getItem: () => JSON.stringify(archived), setItem: () => {} },
      822,
    );
    expect(prepared.notice).toBeNull();
    const loaded = prepared.restore
      ? await prepared.restore(() => {}, new AbortController().signal)
      : prepared;
    expect(loaded.notice).toBeNull();
    expect(loaded.state.franchise!.history).toEqual(
      archived.franchise!.history,
    );
    expect(loaded.state.franchise!.offseasons).toEqual(
      archived.franchise!.offseasons,
    );
    expect(loaded.state.franchise!.trades).toEqual(archived.franchise!.trades);
    const next = startFranchiseSeason(loaded.state, 823);
    expect(next.franchise!.year).toBe(2);
    expect(next.franchise!.history).toEqual(archived.franchise!.history);
    expect(next.run.physicalAbilityVersion).toBe(1);
    expect(
      next.franchise!.teams.every((t) => Object.values(t.roster).length === 8),
    ).toBe(true);
    expect(
      new Set(next.franchise!.teams.flatMap((t) => Object.values(t.roster)))
        .size,
    ).toBe(240);
    const after = prepareGameLoad(
      { getItem: () => JSON.stringify(next), setItem: () => {} },
      823,
    );
    expect(after.notice).toBeNull();
    const mismatched = structuredClone(next);
    delete mismatched.run.physicalAbilityVersion;
    expect(
      prepareGameLoad(
        { getItem: () => JSON.stringify(mismatched), setItem: () => {} },
        823,
      ).notice,
    ).toBeTruthy();
    const corrupted = structuredClone(archived);
    // Older summary-only archives still reconcile the active completed season.
    delete corrupted.franchise!.history[0].replay;
    if (earnedHistory) {
      // Modern progression cannot discard the game provenance behind its XP.
      expect(() =>
        validateFranchise(corrupted.franchise!, corrupted.run),
      ).toThrow();
      return;
    }
    expect(() =>
      validateFranchise(corrupted.franchise!, corrupted.run),
    ).not.toThrow();
    const total = corrupted.franchise!.careers.find(
      (player) => player.regular.abilityActivations?.physical,
    )!.regular.abilityActivations!.physical!;
    total.movement += 1;
    expect(() =>
      validateFranchise(corrupted.franchise!, corrupted.run),
    ).toThrow();
  },
  600000,
);
