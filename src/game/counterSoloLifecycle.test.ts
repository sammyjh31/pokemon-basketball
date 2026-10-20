import { SIGNATURE_MOVE_IDS } from "./moveTypes";
import { createHash, webcrypto } from "node:crypto";
import { expect, it } from "vitest";
import { performanceRun } from "./seasonPerformance.testUtils";
import { initialState, gameReducer } from "./state";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { archiveFranchiseSeason, startFranchiseSeason } from "./franchise";
import { processOffseason } from "./offseason";
import { prepareGameLoad } from "./persistence";
import { ReplayCache } from "./replayCache";
import { memoryReplayRecords } from "./replayCache.testUtils";
import { archivedSeasonRun } from "./archive";
import { validateFranchise } from "./franchiseValidation";
const sha = (v: unknown) =>
  createHash("sha256").update(JSON.stringify(v)).digest("hex");
it("retains all-team counter learning, regular/playoff totals and full history through cold/warm saves", async () => {
  const run = {
    ...performanceRun(),
    movesetVersion: 3 as const,
    draftPool: "all" as const,
  };
  const season = simulateSeason(run);
  expect(season.league!.players.length).toBe(240);
  expect(season.league!.players.every((p) => p.abilityActivations?.moves)).toBe(
    true,
  );
  expect(
    season.league!.players.some((p) =>
      SIGNATURE_MOVE_IDS.some(
        (id) => (p.abilityActivations?.moves?.uses[id] ?? 0) > 0,
      ),
    ),
  ).toBe(true);
  expect(
    season.league!.players.some((p) =>
      Object.values(
        p.abilityActivations?.moves?.combos?.shotsCreated ?? {},
      ).some((n) => n! > 0),
    ),
  ).toBe(true);
  let state = gameReducer(
    { ...initialState(822), run },
    { type: "APPLY_SEASON", source: run, result: season },
  );
  state = {
    ...state,
    run: {
      ...state.run,
      playoffs: simulatePlayoffs(season.league!, run.seasonSeed),
    },
  };
  expect(
    season.league!.games.some(
      (g) => Object.keys(g.scouting?.home.moveReads?.moves ?? {}).length > 0,
    ),
  ).toBe(true);
  expect(
    season.league!.players.filter(
      (p) =>
        Object.keys(p.abilityActivations?.moves?.counters?.responses ?? {})
          .length > 0,
    ).length,
  ).toBeGreaterThan(30);
  expect(
    state.run.playoffs!.series.some((series) =>
      series.games.some(
        (g) => Object.keys(g.scouting?.home.moveReads?.moves ?? {}).length > 0,
      ),
    ),
  ).toBe(true);
  const archived = processOffseason(archiveFranchiseSeason(state));
  validateFranchise(archived.franchise, archived.run, true);
  expect(archivedSeasonRun(archived.franchise!.history[0]).movesetVersion).toBe(
    3,
  );
  const records = memoryReplayRecords(),
    source = JSON.stringify(archived);
  const restore = async (raw = source) => {
    const p = prepareGameLoad(
      {
        getItem: () => raw,
        setItem: () => {
          throw Error("source must stay read-only");
        },
      },
      822,
    );
    const work: number[] = [];
    const value = await p.restore!(
      (_done, total) => work.push(total),
      new AbortController().signal,
      new ReplayCache(
        records.connect(),
        webcrypto as unknown as Crypto,
        "moves",
      ),
    );
    return { value, work };
  };
  const cold = await restore();
  expect(cold.value.notice).toBeNull();
  const warm = await restore(JSON.stringify(cold.value.state));
  expect(sha(warm.value)).toBe(sha(cold.value));
  expect(warm.work.at(-1)).toBe(0);
  const bad = structuredClone(cold.value.state);
  const row = bad.franchise!.careers.find(
    (p) => Object.keys(p.regular.abilityActivations?.moves?.uses ?? {}).length,
  )!;
  row.regular.abilityActivations!.moves!.combos ??= {
    attempts: {},
    shotsCreated: {},
  };
  row.regular.abilityActivations!.moves!.combos.attempts["pick-roll"] =
    (row.regular.abilityActivations!.moves!.combos.attempts["pick-roll"] ?? 0) +
    1;
  expect(() => validateFranchise(bad.franchise, bad.run, true)).toThrow();
  const tampered = structuredClone(cold.value.state);
  const counter = tampered.franchise!.careers.find(
    (p) =>
      Object.keys(
        p.regular.abilityActivations?.moves?.counters?.responses ?? {},
      ).length > 0,
  )!;
  const counts = counter.regular.abilityActivations!.moves!.counters!.responses;
  const key = Object.keys(counts)[0] as keyof typeof counts;
  counts[key]!++;
  expect(() =>
    validateFranchise(tampered.franchise, tampered.run, true),
  ).toThrow();
  const next = startFranchiseSeason(cold.value.state, 823);
  expect(next.run.movesetVersion).toBe(3);
  expect(next.franchise!.history).toEqual(cold.value.state.franchise!.history);
}, 600000);
