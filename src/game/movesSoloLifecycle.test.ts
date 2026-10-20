import type { MoveId } from "./moveTypes";
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
it("retains a complete new-rule solo league, playoffs, careers and move totals across cold/warm restore", async () => {
  const run = { ...performanceRun(), movesetVersion: 1 as const };
  const season = simulateSeason(run);
  expect(season.league!.players.length).toBe(240);
  expect(season.league!.players.every((p) => p.abilityActivations?.moves)).toBe(
    true,
  );
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
  const archived = processOffseason(archiveFranchiseSeason(state));
  validateFranchise(archived.franchise, archived.run, true);
  expect(archivedSeasonRun(archived.franchise!.history[0]).movesetVersion).toBe(
    1,
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
  const move = Object.keys(
    row.regular.abilityActivations!.moves!.uses,
  )[0] as MoveId;
  row.regular.abilityActivations!.moves!.uses[move]!++;
  expect(() => validateFranchise(bad.franchise, bad.run, true)).toThrow();
  const next = startFranchiseSeason(cold.value.state, 823);
  expect(next.run.movesetVersion).toBe(4);
  expect(next.franchise!.history).toEqual(cold.value.state.franchise!.history);
}, 600000);
