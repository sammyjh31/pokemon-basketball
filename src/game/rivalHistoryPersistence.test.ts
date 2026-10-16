import { beforeAll, expect, it } from "vitest";
import { createRun, placePokemon } from "./draft";
import {
  archiveFranchiseSeason,
  enterOffseason,
  startFranchiseSeason,
} from "./franchise";
import { simulateSeason } from "./season";
import { simulatePlayoffs } from "./playoffs";
import { initialState } from "./state";
import { loadGame } from "./persistence";
import { validateFranchise } from "./franchiseValidation";
import { captureRivalScouting } from "./rivalScouting";
import { ROSTER_SLOTS, type GameState } from "./types";
let finished: GameState;
beforeAll(() => {
  let run = createRun("free", true, 82);
  [129, 150, 149, 68, 143, 9, 94, 59].forEach((id, i) => {
    run = placePokemon(run, id, ROSTER_SLOTS[i]);
  });
  const result = simulateSeason(run),
    playoffs = simulatePlayoffs(result.league!, run.seasonSeed);
  finished = {
    ...initialState(82),
    run: { ...run, result, playoffs },
    records: {
      spin: { runs: 0, bestWins: 0, perfectSeasons: 0 },
      free: {
        runs: 1,
        bestWins: result.wins,
        perfectSeasons: Number(result.wins === 82),
      },
    },
  };
}, 30000);
it("archives actual learned rivals, round-trips them and carries them to the next year", () => {
  const archived = archiveFranchiseSeason(finished),
    report = archived.franchise!.history[0].rivalScouting!;
  expect(report).toEqual(
    captureRivalScouting(finished.run.result!.league!, finished.run.playoffs!),
  );
  expect(Object.keys(report.teams)).toHaveLength(30);
  expect(
    Object.values(report.teams).some((r) => r.some((x) => x.playoffGames > 0)),
  ).toBe(true);
  expect(() =>
    validateFranchise(
      archived.franchise,
      archived.run,
      false,
      new Map([
        [
          1,
          { regular: finished.run.result!, playoffs: finished.run.playoffs! },
        ],
      ]),
    ),
  ).not.toThrow();
  const loaded = loadGame(
    { getItem: () => JSON.stringify(archived), setItem: () => {} },
    99,
  );
  expect(loaded.notice).toBeNull();
  expect(loaded.state.franchise!.history[0].rivalScouting).toEqual(report);
  const next = startFranchiseSeason(loaded.state, 93);
  expect(next.franchise!.year).toBe(2);
  expect(next.franchise!.history[0].rivalScouting).toEqual(report);
}, 30000);
it("rejects structurally valid evidence that does not match the archived replay", () => {
  const state = archiveFranchiseSeason(finished),
    f = structuredClone(state.franchise!);
  const row = f.history[0].rivalScouting!.teams[0][0];
  row.losses = row.losses === 0 ? 1 : row.losses - 1;
  const verified = new Map([
    [1, { regular: finished.run.result!, playoffs: finished.run.playoffs! }],
  ]);
  expect(() => validateFranchise(f, state.run, false, verified)).toThrow();
});
it("keeps omitted legacy reports omitted when enriching an archive", () => {
  const legacy = enterOffseason(finished);
  delete legacy.franchise!.history[0].rivalScouting;
  const enriched = archiveFranchiseSeason(legacy);
  expect(enriched.franchise!.history[0].replay).toBeDefined();
  expect(enriched.franchise!.history[0]).not.toHaveProperty("rivalScouting");
});
